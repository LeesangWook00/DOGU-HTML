# DOGU-HTML 협업 개발 가이드

이 문서는 2명이 DOGU-HTML을 동시에 개발할 때 사용하는 역할 분담과 Git 운영 규칙을 정리합니다.

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

## 권장 폴더 구성

```text
DOGU-HTML/
├─ Untitled-1 - 복사본.html  # 프론트엔드 평가 화면
├─ backend/                  # 백엔드 서버와 API
│  ├─ src/
│  ├─ package.json
│  └─ README.md
├─ .vscode/
├─ README.md
└─ COLLABORATION.md
```

현재 평가 화면은 하나의 HTML 파일에 구성되어 있습니다. 프론트엔드 담당자는 HTML 파일을 관리하고, 백엔드 담당자는 `backend/` 폴더를 관리해 같은 파일을 동시에 수정하는 상황을 줄입니다.

## 브랜치 운영

`main` 브랜치는 항상 실행 가능한 상태로 유지합니다.

```text
main
├─ frontend
└─ backend
```

작업을 시작할 때 최신 `main`을 기준으로 각자 브랜치를 만듭니다.

```bash
git checkout main
git pull origin main

# 프론트엔드 담당
git checkout -b frontend

# 백엔드 담당
git checkout -b backend
```

기능별로 더 작은 브랜치를 만들어도 됩니다.

```bash
git checkout -b frontend/jira-button
git checkout -b backend/evaluation-api
```

## 작업 및 업로드 절차

작업 전에 자신의 브랜치가 최신인지 확인합니다.

```bash
git checkout frontend
git pull origin main
```

작업이 끝나면 변경 내용을 확인하고 커밋합니다.

```bash
git status
git diff
git add .
git commit -m "프론트엔드 평가 화면 수정"
git push -u origin frontend
```

백엔드 담당자는 커밋 메시지를 역할에 맞게 작성합니다.

```bash
git add backend
git commit -m "평가 데이터 API 추가"
git push -u origin backend
```

## Pull Request 절차

1. GitHub에서 자신의 브랜치를 `main`으로 병합하는 Pull Request를 만듭니다.
2. 변경 내용, 테스트 방법, 확인이 필요한 부분을 작성합니다.
3. 다른 담당자가 코드를 확인합니다.
4. 문제가 없으면 Pull Request를 `main`에 병합합니다.
5. 병합 후 각자 자신의 브랜치에서 최신 `main`을 다시 받습니다.

```bash
git checkout frontend
git pull origin main
```

`main`에 직접 push하지 않고 Pull Request를 사용하는 것을 권장합니다. 이렇게 하면 서로의 변경 내용을 확인한 뒤 반영할 수 있습니다.

## API 협업 규칙

프론트엔드와 백엔드가 동시에 작업하려면 API 형식을 먼저 합의해야 합니다. API를 변경할 때는 관련 내용을 이 문서 또는 `backend/README.md`에 함께 기록합니다.

예시 API:

```text
GET  /api/evaluations/:id       평가 데이터 조회
POST /api/evaluations           평가 데이터 생성
PUT  /api/evaluations/:id       평가 데이터 수정
POST /api/evaluations/:id/submit 목표 또는 평가 제출
POST /api/evaluations/:id/lock   평가 확정 및 잠금
```

프론트엔드는 백엔드가 완성되기 전까지 임시 JSON 데이터로 화면을 개발할 수 있습니다. API 응답 형식이 정해지면 임시 데이터를 실제 API 호출로 교체합니다.

## 충돌 방지 규칙

- 같은 파일을 동시에 크게 수정하지 않습니다.
- 프론트엔드는 HTML과 화면 관련 파일, 백엔드는 `backend/` 폴더를 우선 담당합니다.
- 공통 파일을 수정해야 할 경우 먼저 상대방에게 알립니다.
- 작업 시작 전 `git pull origin main`을 실행합니다.
- 작은 단위로 자주 커밋합니다.
- 커밋 전에 `git diff`로 불필요한 변경을 확인합니다.
- 충돌이 발생하면 한 사람이 임의로 삭제하지 말고 두 담당자가 함께 내용을 확인합니다.

## Pull Request에 포함할 내용

```text
## 변경 내용
- 어떤 기능을 수정했는지

## 테스트
- 어떤 환경에서 확인했는지
- 확인한 동작은 무엇인지

## 확인 요청
- 상대 담당자가 확인할 부분
```

## 기본 점검

프론트엔드 담당자는 Live Server로 HTML을 실행해 주요 버튼과 화면을 확인합니다. 백엔드 담당자는 서버 실행, API 응답, 오류 처리와 테스트를 확인합니다.

두 담당자 모두 Pull Request를 올리기 전에 다음을 확인합니다.

- 변경한 기능이 정상적으로 실행되는가
- 기존 기능이 깨지지 않았는가
- 민감한 정보나 비밀번호가 커밋에 포함되지 않았는가
- 불필요한 파일이 추가되지 않았는가