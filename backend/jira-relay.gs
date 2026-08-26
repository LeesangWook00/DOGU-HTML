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
      result = getEmployeeProjects(body);
    } else if (action === "createIssue") {
      result = createIssue(body);
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

function jiraFetch_(path, options) {
  var cfg = getJiraConfig_();
  var authHeader = "Basic " + Utilities.base64Encode(cfg.email + ":" + cfg.apiToken);
  var opts = {
    method: (options && options.method) || "get",
    headers: { Authorization: authHeader, Accept: "application/json" },
    muteHttpExceptions: true
  };
  if (options && options.payload) {
    opts.contentType = "application/json";
    opts.payload = JSON.stringify(options.payload);
  }
  var res = UrlFetchApp.fetch(cfg.baseUrl + path, opts);
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
// 참고: Jira Cloud의 예전 GET /rest/api/3/search는 2025-10 이후 완전히 제거(410)되어
// 새 엔드포인트 POST /rest/api/3/search/jql 을 사용합니다.
// 설계 문서: ../JIRA-COMPLETED-WORK-IMPORT.md
function getEmployeeProjects(body) {
  var jiraAccountId = body && body.jiraAccountId;
  if (!jiraAccountId) return { ok: false, error: "missing_account_id" };

  var wantsDone = body && String(body.statusCategory || "").toLowerCase() === "done";
  var startDateFieldId = getStartDateFieldId_();

  var jql = 'assignee = "' + jiraAccountId + '"';
  if (wantsDone) {
    jql += " AND statusCategory = Done ORDER BY resolved DESC, updated DESC";
  } else {
    jql += " ORDER BY updated DESC";
  }

  var fields = ["summary", "status", "project", "description", "subtasks", "issuelinks", "duedate"];
  if (startDateFieldId) fields.push(startDateFieldId);

  var res = jiraFetch_("/rest/api/3/search/jql", {
    method: "post",
    payload: { jql: jql, fields: fields, maxResults: 50 }
  });
  if (res.code !== 200) return { ok: false, error: "jira_request_failed", status: res.code };

  var cfg = getJiraConfig_();
  var issues = (res.body.issues || []).map(function (issue) {
    return issueToSummary_(issue, cfg, startDateFieldId);
  });

  return { ok: true, issues: issues };
}

// Jira 이슈 1건을 프론트엔드 계약(JIRA-COMPLETED-WORK-IMPORT.md) 형식으로 변환
function issueToSummary_(issue, cfg, startDateFieldId) {
  var f = issue.fields || {};
  var statusCategoryKey = f.status && f.status.statusCategory ? f.status.statusCategory.key : "";

  return {
    issueKey: issue.key,
    projectKey: f.project ? f.project.key : "",
    summary: f.summary,
    status: f.status ? f.status.name : "",
    statusCategoryKey: statusCategoryKey,
    isDone: statusCategoryKey === "done",
    startDate: startDateFieldId ? toDateOnly_(f[startDateFieldId]) : "",
    dueDate: toDateOnly_(f.duedate),
    descriptionText: adfToText_(f.description),
    subtasks: (f.subtasks || []).map(function (st) {
      var sf = st.fields || {};
      return {
        issueKey: st.key,
        summary: sf.summary || "",
        status: sf.status ? sf.status.name : "",
        statusCategoryKey: sf.status && sf.status.statusCategory ? sf.status.statusCategory.key : "",
        url: cfg.baseUrl + "/browse/" + st.key
      };
    }),
    linkedIssues: (f.issuelinks || []).map(function (link) {
      var target = link.outwardIssue || link.inwardIssue;
      if (!target) return null;
      var relationship = link.outwardIssue
        ? (link.type && link.type.outward) || ""
        : (link.type && link.type.inward) || "";
      var tf = target.fields || {};
      return {
        relationship: relationship,
        issueKey: target.key,
        summary: tf.summary || "",
        status: tf.status ? tf.status.name : "",
        statusCategoryKey: tf.status && tf.status.statusCategory ? tf.status.statusCategory.key : "",
        url: cfg.baseUrl + "/browse/" + target.key
      };
    }).filter(function (item) { return item !== null; }),
    url: cfg.baseUrl + "/browse/" + issue.key
  };
}

// 스크립트 속성에 설정된 시작 날짜 커스텀 필드 ID (사이트마다 다름, 미설정이면 null)
function getStartDateFieldId_() {
  var id = PropertiesService.getScriptProperties().getProperty("JIRA_START_DATE_FIELD_ID");
  return id || null;
}

// ISO 날짜/날짜시간 문자열에서 YYYY-MM-DD 부분만 추출, 값이 없으면 빈 문자열
function toDateOnly_(value) {
  if (!value) return "";
  var match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

// Atlassian Document Format(ADF) 설명을 평문으로 변환 (문단/제목/목록/체크목록/코드블록/인라인 텍스트)
function adfToText_(adf) {
  if (!adf || !adf.content) return "";
  var lines = [];

  function inlineText(nodes) {
    if (!nodes) return "";
    return nodes.map(function (n) {
      if (n.type === "text") return n.text || "";
      if (n.type === "hardBreak") return "\n";
      if (n.type === "emoji") return (n.attrs && n.attrs.text) || "";
      if (n.type === "mention") return "@" + ((n.attrs && (n.attrs.text || n.attrs.id)) || "");
      if (n.type === "inlineCard" || n.type === "blockCard") return (n.attrs && n.attrs.url) || "";
      return "";
    }).join("");
  }

  function walk(node, prefix) {
    prefix = prefix || "";
    switch (node.type) {
      case "paragraph":
      case "heading":
        lines.push(prefix + inlineText(node.content));
        break;
      case "bulletList":
        (node.content || []).forEach(function (item) { walkListItem_(item, prefix + "- "); });
        break;
      case "orderedList":
        (node.content || []).forEach(function (item, idx) { walkListItem_(item, prefix + (idx + 1) + ". "); });
        break;
      case "taskList":
        (node.content || []).forEach(function (item) {
          var checked = item.attrs && item.attrs.state === "DONE";
          var text = (item.content || []).map(function (c) { return inlineText(c.content); }).join(" ");
          lines.push(prefix + (checked ? "[x] " : "[ ] ") + text);
        });
        break;
      case "codeBlock":
        lines.push(prefix + "```");
        lines.push(inlineText(node.content));
        lines.push(prefix + "```");
        break;
      case "blockquote":
        (node.content || []).forEach(function (c) { walk(c, prefix + "> "); });
        break;
      case "rule":
        lines.push("---");
        break;
      default:
        if (node.content) node.content.forEach(function (c) { walk(c, prefix); });
    }
  }

  function walkListItem_(item, prefix) {
    (item.content || []).forEach(function (c, idx) {
      walk(c, idx === 0 ? prefix : prefix.replace(/[-\d.]/g, " "));
    });
  }

  adf.content.forEach(function (node) { walk(node, ""); });
  return lines.join("\n").trim();
}

// action: createIssue
// 요청 body 예: { action: "createIssue", projectKey: "HR", issueType: "Task", summary: "...", description: "..." }
function createIssue(body) {
  var projectKey = body && body.projectKey;
  var summary = body && body.summary;
  if (!projectKey) return { ok: false, error: "missing_project_key" };
  if (!summary) return { ok: false, error: "missing_summary" };

  var issueType = (body.issueType || "Task").trim() || "Task";
  var payload = {
    fields: {
      project: { key: projectKey },
      issuetype: { name: issueType },
      summary: summary,
      description: textToAdf_(body.description || "")
    }
  };

  var res = jiraFetch_("/rest/api/3/issue", { method: "post", payload: payload });
  if (res.code !== 201) {
    return { ok: false, error: "jira_request_failed", status: res.code, details: res.body };
  }

  var cfg = getJiraConfig_();
  return {
    ok: true,
    issueKey: res.body.key,
    url: cfg.baseUrl + "/browse/" + res.body.key
  };
}

// 평문 텍스트를 Jira REST API v3가 요구하는 Atlassian Document Format으로 변환
function textToAdf_(text) {
  var lines = String(text || "").split("\n");
  var content = lines.map(function (line) {
    return {
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : []
    };
  });
  if (content.length === 0) {
    content = [{ type: "paragraph", content: [] }];
  }
  return { type: "doc", version: 1, content: content };
}
