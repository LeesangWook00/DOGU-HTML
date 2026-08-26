// Apps Script 웹앱: 직원-Jira 계정 확인 + 담당 이슈 조회 중계
// 설계 문서: ../JIRA-ACCOUNT-MAPPING.md
//
// 배포 방법
//   1) script.google.com 에서 새 프로젝트 생성 후 이 파일 내용을 Code.gs에 붙여넣기
//   2) 프로젝트 설정 > 스크립트 속성에 아래 3개 값 등록
//        JIRA_BASE_URL   예: https://회사명.atlassian.net
//        JIRA_EMAIL      Jira API 토큰을 발급한 관리자 계정 이메일
//        JIRA_API_TOKEN  https://id.atlassian.com/manage-profile/security/api-tokens 에서 발급
//   3) 배포 > 새 배포 > 유형: 웹 앱
//        실행 계정: 나
//        액세스 권한: 조직 내 사용자 (또는 링크가 있는 모든 사용자, 데모 단계)
//   4) 배포 후 나오는 웹앱 URL을 프론트엔드 fetch 대상으로 사용

function doPost(e) {
  var result;
  try {
    var body = JSON.parse((e.postData && e.postData.contents) || "{}");
    var action = body.action;

    if (action === "verifyJiraAccount") {
      result = verifyJiraAccount(body.email);
    } else if (action === "getEmployeeProjects") {
      result = getEmployeeProjects(body.jiraAccountId);
    } else {
      result = { ok: false, error: "unknown_action" };
    }
  } catch (err) {
    result = { ok: false, error: "server_error", message: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 배포 확인용 (브라우저로 웹앱 URL 직접 열었을 때)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "jira-relay is running" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getJiraConfig_() {
  var props = PropertiesService.getScriptProperties();
  var cfg = {
    baseUrl: props.getProperty("JIRA_BASE_URL"),
    email: props.getProperty("JIRA_EMAIL"),
    apiToken: props.getProperty("JIRA_API_TOKEN")
  };
  if (!cfg.baseUrl || !cfg.email || !cfg.apiToken) {
    throw new Error("jira_config_missing");
  }
  return cfg;
}

function jiraFetch_(path) {
  var cfg = getJiraConfig_();
  var authHeader = "Basic " + Utilities.base64Encode(cfg.email + ":" + cfg.apiToken);
  var res = UrlFetchApp.fetch(cfg.baseUrl + path, {
    method: "get",
    headers: { Authorization: authHeader, Accept: "application/json" },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code === 401 || code === 403) {
    throw new Error("jira_auth_failed");
  }
  return { code: code, body: JSON.parse(res.getContentText() || "{}") };
}

// action: verifyJiraAccount
function verifyJiraAccount(email) {
  if (!email) return { ok: false, error: "missing_email" };

  var path = "/rest/api/3/user/search?query=" + encodeURIComponent(email);
  var res = jiraFetch_(path);
  if (res.code !== 200) return { ok: false, error: "jira_request_failed" };

  var users = res.body || [];
  var candidates = users.map(function (u) {
    return {
      jiraAccountId: u.accountId,
      displayName: u.displayName,
      email: u.emailAddress || email
    };
  });

  return { ok: true, matched: candidates.length > 0, candidates: candidates };
}

// action: getEmployeeProjects
function getEmployeeProjects(jiraAccountId) {
  if (!jiraAccountId) return { ok: false, error: "missing_account_id" };

  var jql = 'assignee = "' + jiraAccountId + '" ORDER BY updated DESC';
  var path = "/rest/api/3/search?jql=" + encodeURIComponent(jql) +
    "&fields=summary,status,project&maxResults=50";
  var res = jiraFetch_(path);
  if (res.code !== 200) return { ok: false, error: "jira_request_failed" };

  var cfg = getJiraConfig_();
  var issues = (res.body.issues || []).map(function (issue) {
    return {
      issueKey: issue.key,
      projectKey: issue.fields.project ? issue.fields.project.key : "",
      summary: issue.fields.summary,
      status: issue.fields.status ? issue.fields.status.name : "",
      url: cfg.baseUrl + "/browse/" + issue.key
    };
  });

  return { ok: true, issues: issues };
}
