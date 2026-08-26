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
