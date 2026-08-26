 # DOGU-HTML 2인 협업 개발 가이드

프론트엔드 담당자와 백엔드 담당자가 GitHub에서 수정본을 올리고 서로의 최신 내용을 받으며 개발하기 위한 규칙입니다.

## 역할 분담

### 프론트엔드 담당

- `Untitled-1 - 복사본.html` 화면과 사용자 인터페이스 담당
- 입력 폼, 버튼, 화면 배치와 반응형 스타일 수정
- 작성자, 평가자, HR 사용 흐름 구현
- Jira 연동 버튼과 브라우저 동작 관리
- 백엔드 API를 호출하는 화면 로직 구현

### 백엔드 담당

- `backend/` 폴더의 서버 코드 담당
- 평가 데이터 저장, 조회, 수정 API 구현
- 데이터베이스와 서버 환경 설정
- 사용자 인증과 권한 처리
- API 오류 처리와 서버 테스트 작성

## 개발 방향: Jira 자동 연동

사진의 비교표를 기준으로 이 프로젝트는 직원마다 Claude에 로그인해 Jira를 직접 조회하는 방식보다, 평가 앱의 버튼으로 Jira 정보를 자동 조회하는 중앙화 방식을 개발합니다.

### 직접 연동 방식의 문제점

Claude를 직원별로 직접 Jira에 연결하면 다음 문제가 생깁니다.

- 직원마다 Claude 계정과 Jira 연결 설정이 필요합니다.
- 사용자가 매번 Claude를 열고 필요한 티켓을 직접 찾아야 합니다.
- 직원 수가 늘어날수록 계정, 권한, 인증 토큰 관리가 복잡해집니다.
- 개인별 토큰과 권한 관리가 필요해 보안 및 유지보수 부담이 커집니다.
- Claude 또는 플러그인 정책 변경에 영향을 받을 수 있습니다.

### 우리가 개발할 방식

평가 화면의 **Jira 연동하기** 버튼을 누르면 서버가 Jira API를 호출하고, 평가에 필요한 Jira 업무 정보를 화면에 제공하는 방식입니다.

- 직원은 Claude 계정을 별도로 만들 필요가 없습니다.
- 사용자는 평가 화면에서 버튼을 한 번 눌러 Jira 정보를 조회합니다.
- Jira 인증 토큰은 서버 환경변수에만 저장하고 브라우저나 GitHub에 노출하지 않습니다.
- 중앙 서버에서 Jira 권한과 연결 설정을 관리합니다.
- 평가 데이터와 Jira 업무 정보를 연결해 평가 작성 시간을 줄입니다.

## Jira 연동 개발 항목

### 프론트엔드 담당 작업

- 상단 `JSON 내보내기` 옆의 **Jira 연동하기** 버튼 유지
- Jira 프로젝트 키, 이슈 키 또는 조회 조건을 입력하는 UI 추가
- 버튼 클릭 시 백엔드 Jira API 호출
- 조회 중, 성공, 결과 없음, 권한 없음, 서버 오류 상태 표시
- Jira 이슈 제목, 상태, 담당자, 설명, 링크 표시
- 평가 데이터와 Jira 업무를 연결해 화면에 반영
- API 토큰이나 비밀번호를 HTML 코드에 저장하지 않기

### 백엔드 담당 작업

- Jira REST API 연동 모듈 구현
- 서버 환경변수로 Jira 주소, 계정, API 토큰 관리
- Jira 이슈 조회 API 구현
- 프로젝트 또는 이슈 키 입력값 검증
- Jira 응답에서 평가에 필요한 필드만 선별해 반환
- Jira 인증 실패, 권한 부족, 요청 제한, 존재하지 않는 이슈에 대한 오류 처리
- 서버 로그에 API 토큰과 개인정보가 기록되지 않도록 처리
- Jira API 호출 테스트와 오류 응답 테스트 작성

### 예상 API

```text
GET /api/jira/issues/:issueKey       Jira 이슈 1건 조회
GET /api/jira/issues?project=HR      프로젝트 조건으로 이슈 조회
POST /api/evaluations/:id/jira       평가와 Jira 이슈 연결
DELETE /api/evaluations/:id/jira     연결 해제
```

예상 응답은 프론트엔드가 필요한 정보만 받도록 단순화합니다.

```json
{
	"issueKey": "HR-123",
	"summary": "평가 자동화 기능 개발",
	"status": "완료",
	"assignee": "담당자",
	"url": "https://회사명.atlassian.net/browse/HR-123"
}
```

## 보안 원칙

- Jira API 토큰은 `.env` 파일에 저장하고 GitHub에 커밋하지 않습니다.
- `.env`는 `.gitignore`에 등록합니다.
- 프론트엔드에는 Jira 토큰을 전달하지 않습니다.
- 서버가 Jira API를 대신 호출하는 구조를 사용합니다.
- Jira 프로젝트와 이슈에 대한 접근 권한을 최소한으로 부여합니다.
- 오류 메시지와 로그에 토큰, 비밀번호, 전체 인증 헤더를 출력하지 않습니다.

## 단계별 개발 순서

1. 백엔드 담당자가 Jira 인증 방식과 API 응답 형식을 확정합니다.
2. 백엔드 담당자가 서버 환경변수와 Jira 이슈 조회 API를 구현합니다.
3. 프론트엔드 담당자가 임시 JSON으로 조회 결과 화면을 먼저 구현합니다.
4. 프론트엔드 담당자가 임시 JSON을 실제 백엔드 API 호출로 교체합니다.
5. 정상 조회, 이슈 없음, 권한 오류, Jira 서버 오류를 함께 테스트합니다.
6. 테스트가 끝난 변경사항을 각자 브랜치에 올리고 Pull Request로 `main`에 병합합니다.

## 완료 기준

- 직원이 개인 Claude 계정 없이 평가 화면에서 Jira 조회를 실행할 수 있습니다.
- Jira 인증 정보가 브라우저, HTML 소스, GitHub 저장소에 노출되지 않습니다.
- 정상적인 Jira 이슈 정보가 평가 화면에 표시됩니다.
- 잘못된 이슈 키와 권한 오류를 사용자가 이해할 수 있는 메시지로 안내합니다.
- 프론트엔드와 백엔드가 합의한 API 응답 형식으로 동작합니다.
- Jira 연동이 실패해도 기존 평가 작성과 JSON 내보내기 기능은 사용할 수 있습니다.

## 권장 브랜치

`main`은 실행 가능한 상태로 유지하고 각자 작업 브랜치를 사용합니다.

```text
main
├─ frontend
└─ backend
```

처음 작업할 때 각자 한 번만 브랜치를 만듭니다.

```bash
git checkout main
git pull origin main
git checkout -b frontend
```

백엔드 담당자는 마지막 명령을 다음처럼 실행합니다.

```bash
git checkout -b backend
```

## 처음 저장소 받기

새 PC에서 처음 작업할 때 실행합니다.

```bash
git clone https://github.com/LeesangWook00/DOGU-HTML.git
cd DOGU-HTML
```

## 최신 수정본 받기

작업을 시작하기 전에 자신의 브랜치로 이동하고 최신 `main`을 받습니다.

```bash
git checkout frontend
git pull origin main
```

백엔드 담당자는 `frontend` 대신 `backend`를 사용합니다.

다른 담당자의 브랜치 내용을 직접 확인해야 할 때는 다음처럼 받을 수 있습니다.

```bash
git checkout frontend
git pull origin backend
```

일반적으로는 상대방의 Pull Request를 `main`에 병합한 뒤 `git pull origin main`을 사용하는 방식을 권장합니다.

## 수정본 올리기

작업이 끝나면 변경 내용을 확인하고 자신의 브랜치에 올립니다.

```bash
git status
git diff
git add .
git commit -m "수정한 내용을 간단히 작성"
git push -u origin frontend
```

백엔드 담당자는 마지막 명령을 다음처럼 실행합니다.

```bash
git push -u origin backend
```

첫 push 이후에는 `-u` 없이 실행해도 됩니다.

```bash
git push origin frontend
```

## 실제 작업 예시

프론트엔드 담당자가 HTML을 수정해 올리는 경우입니다.

```bash
git checkout frontend
git pull origin main

# Untitled-1 - 복사본.html 수정

git status
git add "Untitled-1 - 복사본.html"
git commit -m "평가 화면 수정"
git push origin frontend
```

백엔드 담당자는 `backend` 폴더를 수정한 뒤 다음처럼 올립니다.

```bash
git checkout backend
git pull origin main

# backend 폴더 수정

git add backend
git commit -m "평가 데이터 API 추가"
git push origin backend
```

## Pull Request로 합치기

1. GitHub에서 자신의 브랜치의 **Pull Request**를 만듭니다.
2. 대상 브랜치를 `main`으로 선택합니다.
3. 변경 내용과 테스트 방법을 작성합니다.
4. 다른 담당자가 코드를 확인합니다.
5. 문제가 없으면 `main`에 병합합니다.
6. 병합 후 각자 `git pull origin main`으로 최신 내용을 받습니다.

`main`에 직접 push하지 않고 Pull Request를 사용하는 것을 권장합니다.

## 충돌 해결

두 사람이 같은 파일의 같은 부분을 수정하면 충돌이 발생할 수 있습니다.

1. VS Code에서 충돌 파일을 엽니다.
2. `Accept Current Change`, `Accept Incoming Change`, `Accept Both Changes` 중 필요한 항목을 선택합니다.
3. 파일을 저장하고 충돌 표시가 모두 사라졌는지 확인합니다.
4. 해결한 내용을 다시 커밋하고 push합니다.

```bash
git status
git add 충돌을_해결한_파일
git commit -m "Git 충돌 해결"
git push origin frontend
```

어느 수정본을 남길지 불분명하면 파일을 임의로 삭제하지 말고 두 담당자가 함께 확인합니다.

## API 협업 규칙

프론트엔드가 호출할 API 형식을 먼저 합의합니다.

```text
GET  /api/evaluations/:id       평가 데이터 조회
POST /api/evaluations           평가 데이터 생성
PUT  /api/evaluations/:id       평가 데이터 수정
POST /api/evaluations/:id/submit 평가 제출
POST /api/evaluations/:id/lock   평가 확정 및 잠금
```

백엔드가 완성되기 전에는 프론트엔드가 임시 JSON 데이터로 화면을 개발할 수 있습니다. API 응답 형식이 확정되면 실제 API 호출로 교체합니다.

## 충돌 방지 규칙

- 프론트엔드는 HTML과 화면 파일을 우선 담당하고, 백엔드는 `backend/` 폴더를 우선 담당합니다.
- 공통 파일을 수정하기 전에는 상대 담당자에게 알립니다.
- 작업 시작 전에 `git pull origin main`을 실행합니다.
- 작은 단위로 자주 커밋합니다.
- 커밋 전에 `git diff`로 변경 내용을 확인합니다.
- 비밀번호, API 토큰, 개인정보가 포함된 파일은 올리지 않습니다.
