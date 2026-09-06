package com.sebang.kosha;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * KOSHA-MS 사내 표준문서 웹 서비스 메인 백엔드 서버
 * JDK 25 표준 내장 HttpServer 기반 (외부 라이브러리 종속성 없음)
 */
public class Main {
    private static final int PORT = 8080;
    private static final Path BASE_DIR = Paths.get(".").toAbsolutePath().normalize();
    private static final Path DATA_DIR = BASE_DIR.resolve("data");
    private static final Path DOCS_DIR = DATA_DIR.resolve("documents");
    private static final Path LOGS_DIR = DATA_DIR.resolve("logs");
    private static final Path PUBLIC_DIR = BASE_DIR.resolve("public");

    // Google Apps Script 웹 앱 URL (sebangtec_hse 스프레드시트 연동)
    public static final String GAS_URL = "https://script.google.com/macros/s/AKfycbz_eDVQVSNSNQ7D7WuPgZ1j7emKQdVK6M5bXyI2rScV51OjoSbKKuAhgrgA7Y5yvwCsaw/exec";
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.ALWAYS)
        .build();

    // 불변 최고 관리자 명단 (Super Admins)
    public static final Set<String> SUPER_ADMINS = Set.of("nschoi@sebangtec.com", "sb06@sebangtec.com");

    // 활성 OTP 임시 저장소 (이메일 -> OTP 코드)
    private static final Map<String, String> OTP_STORE = new ConcurrentHashMap<>();
    // 허용 도메인 정규식
    private static final Pattern ALLOWED_DOMAIN = Pattern.compile("^[a-zA-Z0-9._%+-]+@sebangtec\\.com$");

    public static void main(String[] args) throws IOException {
        // 필수 디렉토리 확인 및 생성
        Files.createDirectories(DOCS_DIR);
        Files.createDirectories(LOGS_DIR);
        Files.createDirectories(DATA_DIR.resolve("users"));
        Files.createDirectories(PUBLIC_DIR);

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());

        // API 라우팅
        server.createContext("/api/gate/verify", new GateVerifyHandler());
        server.createContext("/api/documents", new DocumentHandler());
        server.createContext("/api/search", new SearchHandler());
        server.createContext("/api/auth/otp/request", new OtpRequestHandler());
        server.createContext("/api/auth/otp/verify", new OtpVerifyHandler());
        server.createContext("/api/admins", new AdminHandler());
        server.createContext("/api/sites", new SiteHandler());
        server.createContext("/api/logs/print", new PrintLogHandler());
        server.createContext("/api/logs/login", new LoginLogHandler());

        // 정적 파일 라우팅 (HTML, CSS, JS)
        server.createContext("/", new StaticFileHandler());

        server.start();
        System.out.println("=================================================");
        System.out.println("  KOSHA-MS 사내 표준문서 포털 서버가 시작되었습니다.");
        System.out.println("  접속 주소: http://localhost:" + PORT);
        System.out.println("  프로젝트 경로: " + BASE_DIR);
        System.out.println("=================================================");
    }

    // -------------------------------------------------------------
    // REST API 핸들러 구현
    // -------------------------------------------------------------

    /** 사이트 초기 접속 비밀번호(게이트) 검증 핸들러 (GAS 연동) */
    static class GateVerifyHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            String body = readBody(exchange);
            String password = extractJsonField(body, "password");
            String ip = exchange.getRemoteAddress().getAddress().getHostAddress();
            String userAgent = exchange.getRequestHeaders().getFirst("User-Agent");

            if (password == null || password.isBlank()) {
                sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"비밀번호를 입력해 주세요.\"}");
                return;
            }

            // Google Apps Script로 검증 위임
            String gasPayload = String.format(
                "{\"action\":\"VERIFY_GATE_PASSWORD\",\"password\":\"%s\",\"ip\":\"%s\",\"userAgent\":\"%s\"}",
                password.replace("\"", "\\\""), ip, userAgent != null ? userAgent.replace("\"", "\\\"") : ""
            );

            String gasResponse = callGas(gasPayload);
            if (gasResponse != null && !gasResponse.isBlank()) {
                sendJsonResponse(exchange, 200, gasResponse);
            } else {
                sendJsonResponse(exchange, 502, "{\"success\":false,\"message\":\"Google Apps Script 통신 실패\"}");
            }
        }
    }

    /** 문서 목록 조회 및 개별 문서 조회/수정 */
    static class DocumentHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();

            if ("OPTIONS".equalsIgnoreCase(method)) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            // GET /api/documents (전체 목록)
            if ("GET".equalsIgnoreCase(method) && path.equals("/api/documents")) {
                List<String> docJsons = new ArrayList<>();
                try (var stream = Files.list(DOCS_DIR)) {
                    stream.filter(p -> p.toString().endsWith(".json")).forEach(p -> {
                        try {
                            docJsons.add(Files.readString(p, StandardCharsets.UTF_8));
                        } catch (IOException ignored) {}
                    });
                }
                String response = "[" + String.join(",", docJsons) + "]";
                sendJsonResponse(exchange, 200, response);
                return;
            }

            // GET /api/documents/{id}
            if ("GET".equalsIgnoreCase(method) && path.startsWith("/api/documents/")) {
                String docId = path.substring("/api/documents/".length()).trim();
                Path filePath = DOCS_DIR.resolve(docId + ".json");
                if (Files.exists(filePath)) {
                    String json = Files.readString(filePath, StandardCharsets.UTF_8);
                    sendJsonResponse(exchange, 200, json);
                } else {
                    sendJsonResponse(exchange, 404, "{\"error\":\"Document not found\"}");
                }
                return;
            }

            // POST /api/documents (새 문서 생성 or 개정 저장)
            if ("POST".equalsIgnoreCase(method)) {
                String body = readBody(exchange);
                String docId = extractJsonField(body, "id");
                if (docId == null || docId.isBlank()) {
                    sendJsonResponse(exchange, 400, "{\"error\":\"Document ID is required\"}");
                    return;
                }
                Path filePath = DOCS_DIR.resolve(docId + ".json");
                Files.writeString(filePath, body, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"저장되었습니다.\"}");
                return;
            }

            // DELETE /api/documents/{id} (규정 폐지/삭제)
            if ("DELETE".equalsIgnoreCase(method) && path.startsWith("/api/documents/")) {
                String docId = path.substring("/api/documents/".length()).trim();
                Path filePath = DOCS_DIR.resolve(docId + ".json");
                if (Files.exists(filePath)) {
                    Files.delete(filePath);
                    sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"규정이 삭제/폐지되었습니다.\"}");
                } else {
                    sendJsonResponse(exchange, 404, "{\"error\":\"Document not found\"}");
                }
                return;
            }

            sendJsonResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
        }
    }

    /** 통합 검색 핸들러 */
    static class SearchHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            String query = exchange.getRequestURI().getQuery();
            String keyword = "";
            if (query != null && query.contains("q=")) {
                for (String param : query.split("&")) {
                    if (param.startsWith("q=")) {
                        keyword = URLDecoder.decode(param.substring(2), StandardCharsets.UTF_8).trim().toLowerCase();
                    }
                }
            }

            List<String> matched = new ArrayList<>();
            if (!keyword.isEmpty()) {
                try (var stream = Files.list(DOCS_DIR)) {
                    final String term = keyword;
                    stream.filter(p -> p.toString().endsWith(".json")).forEach(p -> {
                        try {
                            String content = Files.readString(p, StandardCharsets.UTF_8);
                            if (content.toLowerCase().contains(term)) {
                                matched.add(content);
                            }
                        } catch (IOException ignored) {}
                    });
                }
            }

            String response = "[" + String.join(",", matched) + "]";
            sendJsonResponse(exchange, 200, response);
        }
    }

    /** OTP 발송 요청 및 도메인 검증 핸들러 */
    static class OtpRequestHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            String body = readBody(exchange);
            String email = extractJsonField(body, "email");
            String ip = exchange.getRemoteAddress().getAddress().getHostAddress();
            String userAgent = exchange.getRequestHeaders().getFirst("User-Agent");

            if (email == null || email.isBlank()) {
                sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"이메일을 입력해 주세요.\"}");
                return;
            }

            email = email.trim();

            // 도메인 검증 (@sebangtec.com)
            if (!ALLOWED_DOMAIN.matcher(email).matches()) {
                // 감사 로그 기록 (FAIL_INVALID_DOMAIN)
                appendLoginLog(email, "FAIL_INVALID_DOMAIN", ip, userAgent);
                sendJsonResponse(exchange, 403, "{\"success\":false,\"message\":\"허용되지 않은 사내 이메일 도메인입니다. (@sebangtec.com 전용)\"}");
                return;
            }

            // 6자리 OTP 생성 (개발/로컬 테스트용 고정 또는 랜덤 발급)
            // 로컬 테스트 편의를 위해 "123456" 또는 6자리 랜덤 생성
            String otp = String.format("%06d", new Random().nextInt(999999));
            OTP_STORE.put(email, otp);

            // 구글 앱스 스크립트 연동 전 로컬 콘솔에 알림 출력
            System.out.println("[OTP 발송 안내] " + email + " ➔ 인증번호: [" + otp + "]");

            // 감사 로그 기록 (OTP_REQUESTED)
            appendLoginLog(email, "OTP_REQUESTED", ip, userAgent);

            // Google Apps Script (sebangtec_hse 시트 및 Gmail 발송) 비동기 전달
            String gasPayload = String.format(
                "{\"action\":\"REQUEST_OTP\",\"email\":\"%s\",\"ip\":\"%s\",\"userAgent\":\"%s\"}",
                email, ip, userAgent != null ? userAgent.replace("\"", "\\\"") : ""
            );
            callGasAsync(gasPayload);

            // 로컬 편의를 위해 개발 모드에서는 메시지에 otp 함께 반환
            sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"인증번호가 발송되었습니다.\",\"devOtp\":\"" + otp + "\"}");
        }
    }

    /** OTP 검증 및 로그인 처리 핸들러 */
    static class OtpVerifyHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            String body = readBody(exchange);
            String email = extractJsonField(body, "email");
            String otp = extractJsonField(body, "otp");
            String ip = exchange.getRemoteAddress().getAddress().getHostAddress();
            String userAgent = exchange.getRequestHeaders().getFirst("User-Agent");

            if (email == null || otp == null) {
                sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"이메일과 OTP를 모두 입력하세요.\"}");
                return;
            }

            String expectedOtp = OTP_STORE.get(email.trim());
            if (expectedOtp != null && expectedOtp.equals(otp.trim())) {
                OTP_STORE.remove(email.trim());
                // 관리자 및 최고 관리자 여부 확인
                boolean isSuperAdmin = SUPER_ADMINS.contains(email.trim().toLowerCase());
                boolean isAdmin = isSuperAdmin || checkAdmin(email.trim());
                String role = isSuperAdmin ? "SUPER_ADMIN" : (isAdmin ? "ADMIN" : "USER");

                // 감사 로그 기록 (SUCCESS)
                appendLoginLog(email.trim(), "SUCCESS", ip, userAgent);

                sendJsonResponse(exchange, 200, "{\"success\":true,\"email\":\"" + email.trim() + "\",\"isAdmin\":" + isAdmin + ",\"isSuperAdmin\":" + isSuperAdmin + ",\"role\":\"" + role + "\",\"token\":\"token_" + System.currentTimeMillis() + "\"}");
            } else {
                appendLoginLog(email.trim(), "FAIL_INVALID_OTP", ip, userAgent);
                sendJsonResponse(exchange, 401, "{\"success\":false,\"message\":\"인증번호가 일치하지 않습니다.\"}");
            }
        }
    }

    /** 관리자 목록 조회/추가/삭제 핸들러 */
    static class AdminHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            Path adminFile = DATA_DIR.resolve("admins.json");
            String method = exchange.getRequestMethod();

            if ("GET".equalsIgnoreCase(method)) {
                if (Files.exists(adminFile)) {
                    sendJsonResponse(exchange, 200, Files.readString(adminFile, StandardCharsets.UTF_8));
                } else {
                    sendJsonResponse(exchange, 200, "{\"admins\":[]}");
                }
                return;
            }

            if ("POST".equalsIgnoreCase(method)) {
                String body = readBody(exchange);
                Files.writeString(adminFile, body, StandardCharsets.UTF_8);
                sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"관리자 목록이 갱신되었습니다.\"}");
                return;
            }

            sendJsonResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
        }
    }

    /** 현장 및 현장소장 관리 핸들러 (/api/sites) */
    static class SiteHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            Path sitesFile = DATA_DIR.resolve("sites.json");
            Path publicSitesFile = PUBLIC_DIR.resolve("data").resolve("sites.json");
            String method = exchange.getRequestMethod();

            if ("OPTIONS".equalsIgnoreCase(method)) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("GET".equalsIgnoreCase(method)) {
                if (Files.exists(sitesFile)) {
                    sendJsonResponse(exchange, 200, Files.readString(sitesFile, StandardCharsets.UTF_8));
                } else if (Files.exists(publicSitesFile)) {
                    sendJsonResponse(exchange, 200, Files.readString(publicSitesFile, StandardCharsets.UTF_8));
                } else {
                    sendJsonResponse(exchange, 200, "[]");
                }
                return;
            }

            if ("POST".equalsIgnoreCase(method)) {
                String body = readBody(exchange);
                if (body != null && !body.isBlank()) {
                    Files.createDirectories(DATA_DIR);
                    Files.createDirectories(PUBLIC_DIR.resolve("data"));
                    Files.writeString(sitesFile, body, StandardCharsets.UTF_8);
                    Files.writeString(publicSitesFile, body, StandardCharsets.UTF_8);
                    sendJsonResponse(exchange, 200, "{\"success\":true,\"message\":\"현장 목록 및 현장소장 정보가 저장되었습니다.\"}");
                } else {
                    sendJsonResponse(exchange, 400, "{\"success\":false,\"message\":\"요청 본문이 비어 있습니다.\"}");
                }
                return;
            }

            sendJsonResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
        }
    }

    /** 인쇄 감사 로그 핸들러 */
    static class PrintLogHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            Path logFile = LOGS_DIR.resolve("print_logs.json");

            if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                if (Files.exists(logFile)) {
                    sendJsonResponse(exchange, 200, Files.readString(logFile, StandardCharsets.UTF_8));
                } else {
                    sendJsonResponse(exchange, 200, "[]");
                }
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                String body = readBody(exchange);
                String ip = exchange.getRemoteAddress().getAddress().getHostAddress();
                String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

                String userEmail = Optional.ofNullable(extractJsonField(body, "userEmail")).orElse("비회원");
                String docId = Optional.ofNullable(extractJsonField(body, "docId")).orElse("-");
                String docTitle = Optional.ofNullable(extractJsonField(body, "docTitle")).orElse("-");

                String newEntry = String.format(
                    "{\"timestamp\":\"%s\",\"userEmail\":\"%s\",\"docId\":\"%s\",\"docTitle\":\"%s\",\"ip\":\"%s\"}",
                    timestamp, userEmail, docId, docTitle, ip
                );

                synchronized (PrintLogHandler.class) {
                    List<String> list = new ArrayList<>();
                    if (Files.exists(logFile)) {
                        String old = Files.readString(logFile, StandardCharsets.UTF_8).trim();
                        if (old.startsWith("[") && old.endsWith("]")) {
                            String inner = old.substring(1, old.length() - 1).trim();
                            if (!inner.isEmpty()) {
                                list.add(inner);
                            }
                        }
                    }
                    list.add(newEntry);
                    Files.writeString(logFile, "[" + String.join(",", list) + "]", StandardCharsets.UTF_8);
                }

                // Google Apps Script (sebangtec_hse 시트 인쇄이력) 비동기 전송
                String gasPayload = String.format(
                    "{\"action\":\"LOG_PRINT\",\"docId\":\"%s\",\"docTitle\":\"%s\",\"userEmail\":\"%s\",\"ip\":\"%s\"}",
                    docId.replace("\"", "\\\""), docTitle.replace("\"", "\\\""), userEmail.replace("\"", "\\\""), ip
                );
                callGasAsync(gasPayload);

                sendJsonResponse(exchange, 200, "{\"success\":true}");
                return;
            }

            sendJsonResponse(exchange, 405, "{\"error\":\"Method Not Allowed\"}");
        }
    }

    /** 로그인 감사 로그 조회 핸들러 */
    static class LoginLogHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            Path logFile = LOGS_DIR.resolve("login_logs.json");
            if (Files.exists(logFile)) {
                sendJsonResponse(exchange, 200, Files.readString(logFile, StandardCharsets.UTF_8));
            } else {
                sendJsonResponse(exchange, 200, "[]");
            }
        }
    }

    /** 정적 리소스 서빙 (public 디렉토리) */
    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/")) {
                path = "/index.html";
            }

            Path file = PUBLIC_DIR.resolve(path.substring(1)).normalize();
            if (!Files.exists(file) || Files.isDirectory(file)) {
                file = BASE_DIR.resolve(path.substring(1)).normalize();
            }
            if (!Files.exists(file) || Files.isDirectory(file)) {
                sendJsonResponse(exchange, 404, "<h1>404 Not Found</h1>");
                return;
            }

            String contentType = getMimeType(file.getFileName().toString());
            byte[] bytes = Files.readAllBytes(file);
            exchange.getResponseHeaders().set("Content-Type", contentType + "; charset=utf-8");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    // -------------------------------------------------------------
    // 보조 유틸리티 메서드
    // -------------------------------------------------------------

    private static synchronized void appendLoginLog(String email, String status, String ip, String ua) {
        try {
            Path logFile = LOGS_DIR.resolve("login_logs.json");
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            String entry = String.format(
                "{\"timestamp\":\"%s\",\"userEmail\":\"%s\",\"status\":\"%s\",\"ip\":\"%s\",\"userAgent\":\"%s\"}",
                timestamp, email, status, ip, ua != null ? ua.replace("\"", "\\\"") : ""
            );
            List<String> list = new ArrayList<>();
            if (Files.exists(logFile)) {
                String old = Files.readString(logFile, StandardCharsets.UTF_8).trim();
                if (old.startsWith("[") && old.endsWith("]")) {
                    String inner = old.substring(1, old.length() - 1).trim();
                    if (!inner.isEmpty()) list.add(inner);
                }
            }
            list.add(entry);
            Files.writeString(logFile, "[" + String.join(",", list) + "]", StandardCharsets.UTF_8);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static boolean checkAdmin(String email) {
        if (email == null) return false;
        if (SUPER_ADMINS.contains(email.trim().toLowerCase())) return true;
        try {
            Path adminFile = DATA_DIR.resolve("admins.json");
            if (Files.exists(adminFile)) {
                String content = Files.readString(adminFile, StandardCharsets.UTF_8);
                return content.contains("\"" + email + "\"");
            }
        } catch (Exception ignored) {}
        return false;
    }

    private static void sendJsonResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static String extractJsonField(String json, String key) {
        if (json == null) return null;
        String pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"";
        var matcher = java.util.regex.Pattern.compile(pattern).matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    public static String callGas(String jsonPayload) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GAS_URL))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return response.body();
        } catch (Exception e) {
            System.err.println("[GAS 통신 오류] " + e.getMessage());
            return null;
        }
    }

    public static void callGasAsync(String jsonPayload) {
        Thread.ofVirtual().start(() -> {
            callGas(jsonPayload);
        });
    }

    private static String getMimeType(String filename) {
        if (filename.endsWith(".html")) return "text/html";
        if (filename.endsWith(".css")) return "text/css";
        if (filename.endsWith(".js")) return "application/javascript";
        if (filename.endsWith(".json")) return "application/json";
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
        if (filename.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }
}
