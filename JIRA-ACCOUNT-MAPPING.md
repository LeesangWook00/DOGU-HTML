# 직원 ↔ Jira 계정 매핑 설계

이 문서는 DOGU 평가 화면에서 "이메일 입력 → 버튼 클릭 → 지라 프로젝트 자동 반영" 기능을 만들기 위한 **직원-Jira 계정 매핑** 설계입니다. 프론트엔드와 백엔드가 같은 계약을 기준으로 각자 개발할 수 있도록 정리했습니다.

- 백엔드 담당: **Google Apps Script**를 웹앱으로 배포해 이 문서의 요청/응답을 구현합니다. (전용 서버 없음, HR/관리자 Atlassian 계정 1개의 Jira API 토큰만 사용)
- 프론트엔드 담당: 이 문서의 요청/응답 형식에 맞춰 화면과 `fetch` 호출을 구현합니다.

## 전체 방식

직원마다 Claude/Jira 계정을 따로 만드는 방식이 아니라, **HR 계정 1개의 Jira API 토큰으로 서버(Apps Script)가 대신 조회해 결과만 돌려주는 중계 방식**입니다.

- 토큰은 Apps Script의 `PropertiesService`(스크립트 속성)에만 저장 — 브라우저나 GitHub에 노출되지 않음
- 직원은 별도 로그인 없이 DOGU 화면의 버튼만 클릭
- 비용/계정 추가 없이 직원 수와 무관하게 동작

## 왜 매핑이 필요한가

DOGU 화면의 "성명" 입력값만으로는 지라에서 그 사람을 특정할 수 없습니다.

- 지라는 이름이 아니라 **이메일(계정) 또는 accountId**로 사람을 구분합니다.
- 동명이인이 있으면 이름만으로는 다른 사람의 프로젝트가 잘못 연결될 수 있습니다.
- DOGU에 적는 "성명"이 지라 표시 이름과 완전히 같다는 보장이 없습니다.

그래서 이메일로 한 번 Jira 계정을 확인시키고, 그 결과(`jiraAccountId`)를 가지고 있어야 이후 조회가 정확해집니다.

## 매핑을 어디에 저장하는가 — 별도 DB 없음

DOGU는 지금도 서버/DB가 없고, **`localStorage`(브라우저 저장) + JSON 파일 내보내기/불러오기**만으로 동작합니다. 지라 연동 설정(주소, 프로젝트 키 등)도 이미 `localStorage`에 저장하는 방식입니다.

직원-Jira 계정 매핑도 이 방식을 그대로 따릅니다.

- 확인된 매핑(`jiraAccountId`, `jiraDisplayName`)은 **직원의 브라우저 `localStorage`에 저장**합니다. (기존 Jira 설정 저장과 동일한 패턴, 별도 키 사용)
- Apps Script는 별도로 매핑을 저장하지 않고 **매 요청마다 그 자리에서 조회만 하는 무상태(stateless) 구조**입니다.
- 기존 Jira 설정과 같은 제약을 그대로 가집니다: 다른 PC/브라우저로 바꾸면 이메일 확인을 다시 해야 합니다. (README에 이미 안내된 제약과 동일)

이렇게 하면 새 저장소(DB, 스프레드시트 등)를 추가하지 않고도 기존 앱 구조 안에서 매핑 기능을 넣을 수 있습니다.

## 매핑 확인 흐름

1. 직원이 DOGU 화면에서 **사내 이메일**을 입력합니다. (성명 칸 옆에 이메일 입력 칸이 새로 필요합니다.)
2. 프론트엔드가 Apps Script 웹앱 URL로 `action: "verifyJiraAccount"` 요청을 보냅니다.
3. Apps Script가 스크립트 속성에 저장된 Jira API 토큰으로 Jira 사용자 검색 API를 호출해 이메일과 일치하는 계정을 찾습니다.
4. 결과가 1건이면 "이 사람이 맞습니까?"로 지라 표시 이름을 보여주고, 직원이 확인을 누르면 프론트엔드가 `{jiraAccountId, jiraDisplayName}`을 **`localStorage`에 저장**합니다. (서버에는 저장하지 않음)
5. 결과가 여러 건이면 후보 목록을 보여주고 직원이 본인 계정을 선택합니다.
6. 결과가 없으면 안내 메시지를 보여주고, HR에게 문의하도록 안내합니다.
7. `localStorage`에 매핑이 저장된 이후에만 "지라 프로젝트 불러오기" 버튼이 활성화됩니다.

## Apps Script 웹앱 API 설계

Apps Script 웹앱은 URL이 하나이므로, REST 경로 대신 **요청 본문의 `action` 값으로 분기**합니다. 프론트엔드는 `doPost`로 요청을 보냅니다.

> 구현 메모: Apps Script 웹앱은 OPTIONS 프리플라이트를 처리하지 않으므로, 브라우저 CORS 프리플라이트를 유발하지 않도록 `fetch` 요청 시 `Content-Type: text/plain;charset=utf-8`으로 보내고, Apps Script의 `doPost(e)`에서 `e.postData.contents`를 직접 `JSON.parse`합니다. (`application/json`으로 보내면 프리플라이트가 발생해 막힐 수 있습니다.)

### 1. 이메일로 지라 계정 후보 조회

요청 (`doPost` 본문)
```json
{
  "action": "verifyJiraAccount",
  "email": "hong@company.com"
}
```

응답 (일치 1건)
```json
{
  "ok": true,
  "matched": true,
  "candidates": [
    {
      "jiraAccountId": "63f1a2b3c4d5e6f7g8h9",
      "displayName": "홍길동",
      "email": "hong@company.com"
    }
  ]
}
```

응답 (일치 여러 건) — `candidates` 배열에 다건 반환, 프론트엔드는 선택 UI 표시

응답 (일치 없음)
```json
{
  "ok": true,
  "matched": false,
  "candidates": []
}
```

응답 (서버/토큰 오류)
```json
{
  "ok": false,
  "error": "jira_auth_failed"
}
```

### 2. 확인된 계정으로 담당 이슈/프로젝트 조회 (다음 단계, 참고용)

이 문서의 매핑 확인 범위 밖이지만, 매핑 확정 직후 바로 이어지는 호출이라 형식만 미리 맞춰둡니다.

요청
```json
{
  "action": "getEmployeeProjects",
  "jiraAccountId": "63f1a2b3c4d5e6f7g8h9"
}
```

응답
```json
{
  "ok": true,
  "issues": [
    {
      "issueKey": "HR-123",
      "projectKey": "HR",
      "summary": "평가 자동화 기능 개발",
      "status": "완료",
      "url": "https://회사명.atlassian.net/browse/HR-123"
    }
  ]
}
```

### 3. 이슈 생성 (구현 및 프론트엔드 연동 완료)

이 문서의 매핑 확인 범위 밖이지만, 같은 Apps Script 웹앱에 추가된 액션이라 형식을 기록해둡니다. 상세 curl/fetch 예시는 [`backend/README.md`](backend/README.md) 참고.

요청
```json
{
  "action": "createIssue",
  "projectKey": "HR",
  "issueType": "Task",
  "summary": "[평가] 이동수",
  "description": "평가 시스템에서 생성된 Jira 이슈입니다."
}
```

응답 (성공)
```json
{
  "ok": true,
  "issueKey": "HR-124",
  "url": "https://회사명.atlassian.net/browse/HR-124"
}
```

`projectKey`, `summary`는 필수이며 `issueType`을 생략하면 `Task`로 처리됩니다. `description`은 평문 문자열로 보내면 서버가 Jira REST API v3가 요구하는 Atlassian Document Format으로 변환합니다.

> 예전에는 `secure/CreateIssue!default.jspa` 팝업 URL 방식을 사용했으나, 최신 Jira Cloud에서 이슈 생성 폼이 정상적으로 뜨지 않는 문제가 확인되어 이 `createIssue` 액션 호출 방식으로 전환 완료했습니다. curl 테스트로 실제 이슈 생성까지 확인했습니다.

## 프론트엔드가 구현할 부분

- DOGU 기본정보 영역에 **사내 이메일 입력 칸** 추가 (성명 옆).
- **"지라 계정 확인"** 버튼: 클릭 시 Apps Script 웹앱에 `verifyJiraAccount` 요청.
- 후보가 1건이면 확인 모달, 여러 건이면 선택 목록, 없으면 안내 메시지("지라 계정을 찾을 수 없습니다. HR에 문의하세요.").
- 확인되면 `{jiraAccountId, jiraDisplayName}`을 `localStorage`에 저장하고, 화면에 "지라 연동됨" 배지 표시.
- `localStorage`에 매핑이 없으면 "지라 프로젝트 불러오기" 버튼은 비활성 상태 유지.
- Apps Script 웹앱 URL 자체는 코드에 넣어도 되지만, **Jira API 토큰은 절대 프론트엔드 코드/브라우저에 두지 않음** (Apps Script 스크립트 속성에만 존재).

## 예외 상황

| 상황 | 처리 |
|---|---|
| 이메일로 지라 계정을 못 찾음 | 안내 메시지 표시, HR 문의 안내 |
| 후보가 여러 명 | 후보 목록에서 직원이 직접 선택 |
| 다른 PC/브라우저에서 접속 | 기존 지라 설정과 동일하게 이메일 확인을 다시 진행 |
| 직원이 이메일을 잘못 입력해 다른 사람과 매핑됨 | "연동 설정 지우기"로 `localStorage` 매핑 삭제 후 재확인 (기존 지라 설정 지우기와 동일한 방식) |
| Apps Script 배포 계정의 Jira 접근 권한 부족 | `ok: false, error: "jira_auth_failed"` 응답, 화면에 오류 안내 |

## 보안 원칙

- Jira API 토큰은 Apps Script **스크립트 속성(`PropertiesService`)**에만 저장하고 코드, 프론트엔드, GitHub에 절대 커밋하지 않습니다.
- Apps Script 웹앱은 "실행 계정: 나(HR/관리자)", "액세스 권한: 조직 내 사용자"로 배포해 외부 접근을 차단합니다.
- 응답에는 `jiraAccountId`, 표시 이름 등 화면 표시에 필요한 값만 포함하고, 토큰이나 인증 헤더는 절대 포함하지 않습니다.
- Apps Script 실행 로그에 이메일 전체나 토큰 값이 그대로 남지 않도록 주의합니다.

## 이후 단계와의 연결

`localStorage`에 매핑이 저장된 이후, `getEmployeeProjects` 액션으로 해당 직원이 담당한 지라 이슈를 조회해 DOGU의 "프로젝트/업무" 입력 영역에 자동으로 채우는 기능을 이어서 만듭니다. 이 부분은 매핑 확인 기능이 먼저 동작한 뒤에 진행합니다.
