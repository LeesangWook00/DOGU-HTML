# Jira 완료 업무 → DOGU HTML 가져오기 계약

이 문서는 DOGU 프론트엔드의 **Jira 업무 가져오기** 기능에 필요한 백엔드 요청·응답 형식을 정의합니다. 프론트엔드는 이 계약을 기준으로 완료된 Jira 이슈를 프로젝트/업무 카드에 채웁니다.

> 이 문서 작성 작업에서는 백엔드 코드를 수정하지 않습니다. 백엔드 담당자가 `backend/jira-relay.gs`를 확장할 때 참고하는 계약 문서입니다.

## 사용자 흐름

1. 사용자가 DOGU 기본정보에서 사내 이메일을 입력합니다.
2. 사용자가 상단 **Jira 연동**을 누릅니다.
3. 저장된 계정 매핑이 없으면 프론트엔드가 자동으로 `verifyJiraAccount`를 호출합니다.
4. 사용자가 검색된 Jira 계정 확인 모달에서 본인 계정을 선택합니다.
5. 계정 확인이 끝나면 프론트엔드가 별도의 추가 클릭 없이 `getEmployeeProjects`를 호출합니다.
6. 백엔드는 해당 사용자가 담당한 **완료 상태** 이슈만 반환합니다.
7. 프론트엔드는 사이트 디자인과 같은 **Jira 연동 모달**에 완료 이슈 목록을 표시합니다.
8. 사용자가 가져올 업무를 체크하고 필요하면 시작 날짜와 기한을 수정합니다.
9. **선택한 업무 HTML에 가져오기**를 누르면 체크한 이슈만 빈 프로젝트/업무 카드에 순서대로 반영됩니다.

Jira 영역의 **지라 계정 확인** 버튼을 먼저 눌러 계정을 연결하는 기존 방식도 계속 지원합니다.

## 계정 확인과 자동 가져오기 상태

프론트엔드는 이메일 입력값 자체와 확인된 Jira 계정 매핑을 구분합니다.

- 이메일 입력만으로는 `jiraAccountId`를 알 수 없으므로 계정 확인 API가 필요합니다.
- **Jira 연동** 클릭 시 매핑이 없고 이메일이 유효하면 계정 확인을 자동 실행합니다.
- 계정 후보가 한 명이어도 사용자가 **이 계정이 맞습니다**를 눌러야 매핑을 저장합니다.
- 확인된 매핑은 `dogu_jira_account_mapping` 키로 브라우저 `localStorage`에 저장합니다.
- 이메일 입력값이 바뀌면 기존 매핑을 제거하고 새 이메일로 다시 확인합니다.

## DOGU 필드 매핑

| DOGU 입력 필드 | Jira 데이터 | 처리 규칙 |
|---|---|---|
| 프로젝트/업무명 | `summary` | Jira 제목을 그대로 입력합니다. 이슈 키를 제목 앞에 붙이지 않습니다. |
| 기간 | `startDate`, `dueDate` | 둘 다 있으면 `YYYY.MM.DD ~ YYYY.MM.DD`, 하나만 있으면 존재하는 날짜만 표시합니다. 둘 다 없으면 기존 HTML 값을 덮어쓰지 않아 사용자가 직접 입력할 수 있게 합니다. |
| 업무 요약 | `descriptionText`, `subtasks`, `linkedIssues` | `[설명]`, `[하위 작업]`, `[연결된 업무 항목]` 섹션으로 합쳐 입력합니다. |
| 나의 역할/담당 | 매핑 없음 | 자동으로 변경하지 않습니다. |
| 주요 성과 및 기여도 | 매핑 없음 | 자동으로 변경하지 않습니다. 사용자가 직접 작성합니다. |

## API 요청

기존 Apps Script 웹앱의 `getEmployeeProjects` 액션을 유지합니다. 새 프론트엔드는 상세 필드와 완료 상태를 요청한다는 의미로 호환 가능한 옵션도 함께 보냅니다. 기존 백엔드는 추가 속성을 무시해도 됩니다.

```json
{
  "action": "getEmployeeProjects",
  "jiraAccountId": "63f1a2b3c4d5e6f7g8h9",
  "statusCategory": "done",
  "includeDetails": true
}
```

Apps Script의 브라우저 호출은 CORS 프리플라이트를 피하기 위해 다음 헤더를 사용합니다.

```text
Content-Type: text/plain;charset=utf-8
```

## API 성공 응답

```json
{
  "ok": true,
  "issues": [
    {
      "issueKey": "KAN-7",
      "projectKey": "KAN",
      "summary": "프론트엔드",
      "status": "해결됨",
      "statusCategoryKey": "done",
      "isDone": true,
      "startDate": "2026-08-24",
      "dueDate": "2026-08-25",
      "descriptionText": "평가 화면의 Jira 가져오기 기능을 구현했습니다.",
      "subtasks": [
        {
          "issueKey": "KAN-21",
          "summary": "가져오기 버튼 UI 구현",
          "status": "완료",
          "statusCategoryKey": "done",
          "url": "https://회사명.atlassian.net/browse/KAN-21"
        }
      ],
      "linkedIssues": [
        {
          "relationship": "관련됨",
          "issueKey": "KAN-3",
          "summary": "Jira 중계 API 구현",
          "status": "완료",
          "statusCategoryKey": "done",
          "url": "https://회사명.atlassian.net/browse/KAN-3"
        }
      ],
      "url": "https://회사명.atlassian.net/browse/KAN-7"
    }
  ]
}
```

## 필드 요구사항

### 완료 상태

백엔드는 JQL에서 완료 카테고리를 제한하는 방식을 권장합니다.

```text
assignee = "<jiraAccountId>" AND statusCategory = Done ORDER BY resolved DESC, updated DESC
```

- `statusCategoryKey`에는 Jira 상태 카테고리의 `key`를 반환합니다.
- 완료 이슈는 `statusCategoryKey: "done"`, `isDone: true`로 반환합니다.
- 프론트엔드도 방어적으로 완료 상태를 다시 검사합니다.
- 한국어 상태명이 `해결됨`, `완료`가 아니더라도 상태 카테고리가 `done`이면 포함됩니다.

### 기간

- `startDate`, `dueDate`는 `YYYY-MM-DD` 형식 또는 빈 문자열로 반환합니다.
- Jira Cloud의 시작 날짜 필드 ID는 사이트별로 다를 수 있습니다.
- 백엔드에서는 스크립트 속성 등에 `JIRA_START_DATE_FIELD_ID`를 두고 실제 필드 ID를 설정하는 방식을 권장합니다.
- 시작 날짜 필드가 설정되지 않았거나 값이 없으면 `startDate: ""`를 반환합니다.
- Jira 기본 기한 필드는 `duedate`이며 값이 없으면 `dueDate: ""`를 반환합니다.
- 프론트엔드는 호환성을 위해 `startDate`, `startdate`, `start_date`, `fields.startDate`, `fields.startdate`, `fields.customfield_10015`를 시작일 후보로 읽습니다.
- 기한은 `dueDate`, `duedate`, `due_date`, `fields.dueDate`, `fields.duedate`를 읽습니다.
- 조회된 날짜는 Jira 연동 모달의 날짜 입력란에 먼저 표시되며 사용자가 반영 전에 수정할 수 있습니다.

## Jira 연동 모달과 선택 반영

- 페이지 상단의 **Jira 연동** 버튼으로 모달을 엽니다.
- 완료된 업무마다 체크박스, Jira 제목, 프로젝트 키, 상태, 기간, 상세 데이터 건수와 Jira 링크를 표시합니다.
- **전체 선택/전체 해제**를 지원합니다.
- 체크하지 않은 업무는 DOGU 입력란에 반영하지 않습니다.
- 선택된 업무가 여러 개면 빈 프로젝트/업무 카드를 순서대로 사용하고, 부족하면 편집 가능한 범위에서 카드를 자동 추가합니다.
- 평가 문서가 잠겨 카드를 추가할 수 없으면 반영된 건수와 실패 이유를 오류 팝업으로 표시합니다.
- 시작 날짜나 기한이 응답에 없으면 모달의 날짜 입력란에서 사용자가 직접 지정할 수 있습니다.

## 백엔드 구현 상태

`backend/jira-relay.gs`의 `getEmployeeProjects`가 이 문서의 확장 응답을 구현 완료했습니다 (`statusCategoryKey`, `isDone`, `startDate`, `dueDate`, `descriptionText`, `subtasks`, `linkedIssues` 모두 반환).

- `dueDate`는 Jira 기본 필드(`duedate`)라 별도 설정 없이 자동으로 채워집니다.
- `startDate`는 사이트마다 커스텀 필드 ID가 달라서, Apps Script 스크립트 속성에 `JIRA_START_DATE_FIELD_ID`를 설정해야 자동으로 채워집니다 (`backend/README.md` 참고). 설정 전에는 `startDate: ""`로 반환되어 프론트엔드 모달에서 사용자가 직접 입력하는 기존 동작으로 자연스럽게 폴백됩니다.
- `descriptionText`, `subtasks`, `linkedIssues`는 별도 설정 없이 항상 채워집니다.

### 설명

- Jira REST API v3의 `description`은 Atlassian Document Format(ADF) 객체입니다.
- 백엔드가 ADF를 평문으로 변환해 `descriptionText`로 반환해야 합니다.
- 문단, 제목, 목록, 체크 목록, 코드 블록, 인라인 텍스트는 읽는 순서대로 줄바꿈을 유지합니다.
- 프론트엔드에는 ADF 원본 대신 평문을 보내는 것을 원칙으로 합니다.

### 하위 작업

`subtasks` 배열의 각 항목에는 다음 필드를 반환합니다.

| 필드 | 필수 | 설명 |
|---|---|---|
| `issueKey` | 필수 | 하위 작업 이슈 키 |
| `summary` | 필수 | 하위 작업 제목 |
| `status` | 권장 | 현재 상태 표시명 |
| `statusCategoryKey` | 권장 | `new`, `indeterminate`, `done` 중 하나 |
| `url` | 권장 | Jira 이슈 링크 |

### 연결된 업무 항목

`linkedIssues` 배열의 각 항목에는 다음 필드를 반환합니다.

| 필드 | 필수 | 설명 |
|---|---|---|
| `relationship` | 필수 | 예: `차단함`, `다음에 의해 차단됨`, `복제함`, `관련됨` |
| `issueKey` | 필수 | 연결된 이슈 키 |
| `summary` | 필수 | 연결된 이슈 제목 |
| `status` | 권장 | 현재 상태 표시명 |
| `statusCategoryKey` | 권장 | 연결된 이슈의 상태 카테고리 |
| `url` | 권장 | Jira 이슈 링크 |

Jira `issuelinks`의 `outwardIssue`와 `inwardIssue`를 모두 처리해야 하며, 각각 `outward`, `inward` 설명을 `relationship`에 넣습니다.

## Jira 조회 필드 권장 목록

`POST /rest/api/3/search/jql` 호출 시 최소한 다음 필드를 요청합니다.

```text
summary,status,description,subtasks,issuelinks,duedate,<시작 날짜 커스텀 필드>
```

응답 크기가 커질 수 있으므로 `maxResults`는 현재 프론트엔드 기준 최대 50건을 권장합니다.

## 오류 응답

```json
{ "ok": false, "error": "missing_account_id" }
```

```json
{ "ok": false, "error": "jira_auth_failed" }
```

```json
{ "ok": false, "error": "jira_request_failed", "status": 400 }
```

토큰, 인증 헤더, Jira 관리자 이메일, ADF 원본의 불필요한 개인정보는 응답이나 로그에 포함하지 않습니다.

## 프론트엔드 오류 팝업

Jira 작업을 진행할 수 없는 오류는 상단 상태 문구에만 표시하지 않고 `role="alertdialog"`인 **Jira 연동 오류** 팝업으로 표시합니다.

| 상황 | 팝업 안내 |
|---|---|
| 이메일이 비어 있거나 형식이 잘못됨 | 올바른 사내 이메일 입력 요청 |
| Jira 계정을 찾지 못함 | 이메일 확인 또는 HR 문의 안내 |
| `jira_auth_failed` | Jira 인증 정보 또는 접근 권한 확인 안내 |
| `jira_request_failed` | Jira 요청 처리 실패 및 권한 확인 안내 |
| 중계 서버 연결 실패·시간 초과 | 잠시 후 재시도 안내 |
| 프로젝트/업무 입력란을 추가할 수 없음 | 평가 문서 잠금 상태 확인 안내 |

팝업은 **확인**, **닫기**, 배경 클릭, `Esc` 키로 닫을 수 있습니다. 팝업을 닫아도 기존 DOGU 입력 데이터는 변경되지 않습니다.

## 프론트엔드 호환성

현재 프론트엔드는 이전 응답과도 동작하도록 다음 처리를 포함합니다.

- `statusCategoryKey`가 없으면 상태 표시명 `해결됨`, `완료`, `Done`, `Resolved`, `Closed`를 완료로 인식합니다.
- `descriptionText`가 없으면 문자열 형태의 `description`을 사용합니다.
- `linkedIssues`가 없으면 임시 호환 필드인 `linkedWorkItems`도 읽습니다.
- 날짜 정보가 없으면 기간 입력란을 덮어쓰지 않습니다.
- 여러 날짜 필드 이름을 정규화하며, 모달에서 사용자가 입력한 날짜를 최종값으로 우선 사용합니다.
- 상단 **Jira 연동**은 저장된 매핑이 없을 때 계정 확인부터 자동으로 이어서 실행합니다.
- 오류 메시지는 모드 표시와 섞이지 않도록 구분하고 별도 오류 팝업으로 제공합니다.

설명·하위 작업·연결된 업무 확장 응답은 백엔드에 구현 완료되어, 배포된 웹앱 URL을 최신 버전으로 재배포하면 별도 프론트엔드 변경 없이 자동으로 채워집니다.

## 완료 기준

- 진행 중이거나 해야 할 일 상태의 이슈는 HTML 목록에 표시되지 않습니다.
- Jira 제목이 DOGU의 프로젝트/업무명에 그대로 입력됩니다.
- 날짜가 있는 이슈는 기간이 자동 입력됩니다.
- 날짜가 없는 이슈는 모달에서 직접 지정할 수 있고, 지정하지 않으면 기존 기간 값을 보존합니다.
- 설명, 모든 하위 작업, 모든 연결된 업무 항목이 업무 요약에 구분되어 입력됩니다.
- 체크한 Jira 업무만 HTML에 반영되며 체크하지 않은 업무는 변경을 일으키지 않습니다.
- 이메일 입력 후 **Jira 연동** 한 번으로 계정 확인과 업무 조회가 순서대로 이어집니다.
- 계정 확인 또는 업무 조회 실패 이유가 오류 팝업에 표시됩니다.
- Jira 연동에 실패해도 DOGU의 기존 작성·저장·JSON 내보내기 기능은 계속 동작합니다.
