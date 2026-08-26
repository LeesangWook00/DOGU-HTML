# backend (Jira 연동 중계 - Google Apps Script)

전용 서버 없이 **Google Apps Script 웹앱**으로 Jira API를 대신 호출하는 백엔드입니다. 설계 배경은 [`../JIRA-ACCOUNT-MAPPING.md`](../JIRA-ACCOUNT-MAPPING.md) 참고.

## 배포된 웹앱 URL (프론트엔드 연동용)

```
https://script.google.com/macros/s/AKfycbxXLagAQGcfSEPxjgmi7EU-iTpUnHzyFpeWxfAox-zprgWosxt5L7v08a-jxMwrrN-_/exec
```

`verifyJiraAccount`, `getEmployeeProjects` 두 액션 모두 테스트 Jira 계정으로 정상 동작 확인 완료. 요청/응답 형식은 `../JIRA-ACCOUNT-MAPPING.md` 참고.

## 파일

- `jira-relay.gs` — Apps Script에 그대로 붙여넣을 코드. `verifyJiraAccount`, `getEmployeeProjects` 두 액션 처리.

## 데모까지 준비 순서

### 1. Jira API 토큰 발급 (HR/관리자 계정으로, 본인이 직접)

1. 회사 Jira에 로그인할 관리자 계정으로 <https://id.atlassian.com/manage-profile/security/api-tokens> 접속
2. **Create API token** 클릭 후 토큰 값 복사 (한 번만 보여주므로 안전한 곳에 임시 보관)

### 2. Apps Script 프로젝트 생성

1. <https://script.google.com> 접속 → 새 프로젝트
2. `jira-relay.gs` 내용을 프로젝트의 `Code.gs`에 그대로 붙여넣기
3. 프로젝트 이름을 알아보기 쉽게 변경 (예: `DOGU-Jira-Relay`)

### 3. 스크립트 속성 등록 (토큰은 여기에만 저장)

Apps Script 편집기 좌측 **프로젝트 설정(톱니바퀴)** → **스크립트 속성** → 다음 3개 추가

| 속성 이름 | 값 |
|---|---|
| `JIRA_BASE_URL` | 예: `https://회사명.atlassian.net` |
| `JIRA_EMAIL` | 1번에서 토큰을 발급한 계정 이메일 |
| `JIRA_API_TOKEN` | 1번에서 복사한 토큰 값 |

### 4. 웹앱으로 배포

1. 우측 상단 **배포 → 새 배포**
2. 유형: **웹 앱**
3. 실행 계정: **나**
4. 액세스 권한: **조직 내 사용자** (사내 데모용. 외부 공개가 필요 없다면 이 옵션 유지)
5. 배포 후 나오는 **웹앱 URL**을 복사해 프론트엔드 담당자에게 전달

### 5. 배포 확인

브라우저로 웹앱 URL을 그냥 열어보면 다음이 떠야 정상입니다.

```json
{ "ok": true, "message": "jira-relay is running" }
```

### 6. 실제 동작 테스트 (curl)

```bash
curl -X POST "<웹앱 URL>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"verifyJiraAccount","email":"본인 사내 이메일"}'
```

정상이면 아래처럼 후보 목록이 옵니다.

```json
{ "ok": true, "matched": true, "candidates": [ { "jiraAccountId": "...", "displayName": "...", "email": "..." } ] }
```

`jiraAccountId`를 복사해서 두 번째 액션도 확인합니다.

```bash
curl -X POST "<웹앱 URL>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"getEmployeeProjects","jiraAccountId":"위에서 나온 accountId"}'
```

이 두 curl 테스트가 정상 응답을 주면 백엔드는 데모 준비 완료 상태입니다.

## 프론트엔드 연동 참고 (fetch 예시)

Apps Script 웹앱은 CORS 프리플라이트를 처리하지 않으므로, 요청 시 `Content-Type: text/plain;charset=utf-8`으로 보내야 합니다.

```js
async function verifyJiraAccount(email) {
  const res = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "verifyJiraAccount", email })
  });
  return res.json();
}
```

응답/에러 형식은 `../JIRA-ACCOUNT-MAPPING.md`의 API 설계 섹션을 따릅니다.

## 알려진 제약 (데모 단계)

- 매핑 결과는 서버에 저장하지 않고 프론트엔드 `localStorage`에 캐싱하는 구조입니다 (설계 문서 참고).
- 이메일 검색은 Jira의 사용자 검색 API 특성상 조직 설정에 따라 일부 계정이 검색 결과에서 제외될 수 있습니다. 데모 전 본인 계정으로 먼저 테스트해보세요.
- `JIRA_API_TOKEN`이 들어간 스크립트 속성은 Apps Script 프로젝트를 공유하면 함께 노출될 수 있으니, 프로젝트 공유 범위에 주의합니다.
