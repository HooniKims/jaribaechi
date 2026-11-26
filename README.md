# 학급 자리배치 도우미

GitHub Pages: https://hoonikims.github.io/jaribaechi/

## GitHub Pages 배포 (Deploy from a branch)

저장소의 Settings → Pages → Build and deployment에서 Source를 `Deploy from a branch`, Branch를 `gh-pages`, 폴더를 `/ (root)`로 선택한 뒤 Save합니다. `gh-pages`에는 실행 가능한 정적 사이트가 들어 있습니다. 별도의 사용자 정의 GitHub Actions 워크플로는 사용하지 않습니다.

## 코드 수정 후 배포

Node.js 22 환경에서 아래 명령을 실행합니다. GitHub에 쓰기 권한이 있는 Git 인증이 필요합니다.

```sh
npm ci
npm run deploy
```

`predeploy`가 자동으로 `npm run build`를 실행하고 `gh-pages` 패키지가 빌드 결과를 `gh-pages` 브랜치에 게시합니다. 원본 소스는 `main`에서 관리합니다.

## 로컬 실행

```sh
npm ci
npm start
```

학생 명단은 브라우저 로컬 저장소에 보관되며 NAS 주소와 GitHub Pages 주소 간 자동 이전되지 않습니다.
