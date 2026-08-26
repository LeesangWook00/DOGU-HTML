# 직원 ↔ Jira 계정 매핑 설계

이 문서는 DOGU 평가 화면에서 "성명 입력 → 버튼 클릭 → 지라 프로젝트 자동 반영" 기능을 만들기 위한 **직원-Jira 계정 매핑** 설계입니다. 백엔드와 프론트엔드가 같은 계약(API, 데이터 구조)을 기준으로 각자 개발할 수 있도록 정리했습니다.

- 백엔드 담당: 이 문서의 데이터 구조와 API를 구현합니다.
- 프론트엔드 담당: 이 문서의 API 요청/응답 형식에 맞춰 화면을 구현합니다.

## 왜 매핑이 필요한가

DOGU 화면의 "성명" 입력값만으로는 지라에서 그 사람을 특정할 수 없습니다.

- 지라는 이름이 아니라 **이메일(계정) 또는 accountId**로 사람을 구분합니다.
- 동명이인이 있으면 이름만으로는 다른 사람의 프로젝트가 잘못 연결될 수 있습니다.
- DOGU에 적는 "성명"이 지라 표시 이름과 완전히 같다는 보장이 없습니다(중간에 직급, 영문명 등 표기 차이 발생 가능).

그래서 "이름을 입력하면 자동으로 지라 프로젝트가 나온다"는 사용자 경험 뒤에는, **사번/이메일 기준으로 확인된 매핑**이 먼저 저장되어 있어야 합니다.

## 매핑 데이터 구조

백엔드가 저장·관리하는 매핑 레코드입니다.

| 필드 | 설명 |
|---|---|
| `employeeId` | 사번. 매핑의 기본 키. |
| `name` | DOGU에 입력된 성명(표시용, 매칭 근거로는 사용하지 않음). |
| `companyEmail` | 사내 이메일. 매칭의 1차 근거. |
| `team` | 소속/팀 (표시용). |
| `jiraAccountId` | Jira Cloud의 고유 계정 ID. 매핑 확정 후 실제 조회에 사용하는 값. |
| `jiraEmail` | 지라에 등록된 이메일(사내 이메일과 다를 수 있음). |
| `jiraDisplayName` | 지라 표시 이름(확인 화면에 보여주는 용도). |
| `mappingStatus` | `unmapped` \| `pending_confirm` \| `confirmed` \| `failed` |
| `mappingSource` | `auto`(이메일 자동 매칭) \| `manual`(HR이 직접 등록) |
| `lastSyncedAt` | 마지막으로 지라 데이터를 동기화한 시각. |
| `createdAt` / `updatedAt` | 매핑 레코드 생성/수정 시각. |

**매핑 기준은 `employeeId`(사번)입니다.** 이름은 표시용일 뿐 식별자로 쓰지 않습니다. 이렇게 해야 동명이인, 개명, 팀 이동이 있어도 매핑이 깨지지 않습니다.

## 매핑 확인 흐름

1. 직원이 DOGU 화면에서 **사내 이메일**을 입력합니다. (성명 칸 옆에 이메일 입력 칸이 새로 필요합니다.)
2. 프론트엔드가 `POST /api/jira/account-mapping/verify`를 호출합니다.
3. 백엔드가 서버에 저장된 Jira API 토큰으로 Jira 사용자 검색 API를 호출해 이메일과 일치하는 계정을 찾습니다.
4. 결과가 1건이면 "이 사람이 맞습니까?" 형태로 지라 표시 이름을 보여주고, 직원이 확인을 누르면 프론트엔드가 `POST /api/jira/account-mapping`으로 매핑을 저장합니다.
5. 결과가 여러 건이면 후보 목록을 보여주고 직원이 본인 계정을 선택합니다.
6. 결과가 없으면 매핑을 `failed` 상태로 남기고, HR이 수동으로 매핑을 등록할 수 있도록 안내합니다.
7. 매핑이 `confirmed` 상태가 된 이후에만 "지라 프로젝트 불러오기" 버튼이 활성화됩니다.

## API 설계

### 1. 이메일로 지라 계정 후보 조회

```
POST /api/jira/account-mapping/verify
```

요청
```json
{
  "employeeId": "EMP1023",
  "email": "hong@company.com"
}
```

응답 (일치 1건)
```json
{
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
  "matched": false,
  "candidates": []
}
```

### 2. 매핑 확정 저장

```
POST /api/jira/account-mapping
```

요청
```json
{
  "employeeId": "EMP1023",
  "jiraAccountId": "63f1a2b3c4d5e6f7g8h9",
  "confirmedBy": "self"
}
```

응답
```json
{
  "employeeId": "EMP1023",
  "jiraAccountId": "63f1a2b3c4d5e6f7g8h9",
  "jiraDisplayName": "홍길동",
  "mappingStatus": "confirmed"
}
```

`confirmedBy`는 `"self"`(직원 본인 확인) 또는 `"hr"`(HR이 수동 등록)입니다.

### 3. 매핑 조회

```
GET /api/jira/account-mapping/:employeeId
```

응답
```json
{
  "employeeId": "EMP1023",
  "jiraAccountId": "63f1a2b3c4d5e6f7g8h9",
  "jiraDisplayName": "홍길동",
  "mappingStatus": "confirmed",
  "lastSyncedAt": "2026-08-20T09:00:00+09:00"
}
```

매핑이 없으면 `mappingStatus: "unmapped"`와 함께 나머지 필드는 `null`로 반환합니다.

### 4. 매핑 해제/재설정 (HR 전용)

```
DELETE /api/jira/account-mapping/:employeeId
```

직원이 퇴사, 이메일 변경, 잘못된 계정 연결 등으로 매핑을 다시 잡아야 할 때 HR이 사용합니다.

## 프론트엔드가 구현할 부분

- DOGU 기본정보 영역에 **사내 이메일 입력 칸** 추가 (성명 옆).
- **"지라 계정 확인"** 버튼: 클릭 시 `verify` API 호출.
- 후보가 1건이면 확인 모달, 여러 건이면 선택 목록, 없으면 안내 메시지("지라 계정을 찾을 수 없습니다. HR에 문의하세요.").
- 확인 후 `mappingStatus`를 화면에 표시(예: 배지 형태로 "지라 연동됨" / "미연동").
- 매핑이 `confirmed`가 아니면 "지라 프로젝트 불러오기" 버튼은 비활성 상태 유지.
- API 토큰이나 지라 인증 정보는 프론트엔드에서 절대 다루지 않음 (백엔드가 대신 호출).

## 예외 상황

| 상황 | 처리 |
|---|---|
| 이메일로 지라 계정을 못 찾음 | `mappingStatus: failed`로 저장, HR 수동 등록 안내 |
| 후보가 여러 명 | 후보 목록에서 직원이 직접 선택 |
| 사내 이메일과 지라 이메일이 다름 | HR이 `manual`로 직접 `jiraAccountId` 입력해 매핑 |
| 직원이 이메일을 잘못 입력해 다른 사람과 매핑됨 | HR이 `DELETE`로 매핑 해제 후 재확인 |
| 직원 퇴사/부서 이동 | `employeeId` 기준 매핑은 유지, 필요 시 HR이 해제 |

## 보안 원칙

- Jira API 토큰은 서버 환경변수(`.env`)에만 저장하고 프론트엔드나 GitHub에 노출하지 않습니다.
- 매핑 저장/삭제 API는 본인 확인(`self`) 또는 HR 권한(`hr`)이 있는 요청만 처리합니다.
- 매핑 조회 응답에는 `jiraAccountId`, 표시 이름 정도만 포함하고, 지라 인증 관련 값은 절대 포함하지 않습니다.
- 서버 로그에 이메일 전체나 accountId를 그대로 남기지 않도록 마스킹을 검토합니다.

## 이후 단계와의 연결

매핑이 `confirmed` 상태가 되면, 다음 단계로 이 문서에서 다루지 않은 별도 API(`GET /api/jira/employees/:employeeId/projects` 등)를 통해 해당 직원이 담당한 지라 이슈/프로젝트를 조회해 DOGU의 "프로젝트/업무" 입력 영역에 자동으로 채우는 기능을 만듭니다. 이 부분은 매핑이 먼저 확정된 이후에 진행합니다.
