# 학급 자리배치 도우미

GitHub Pages: https://hoonikims.github.io/jaribaechi/

## 배포

Settings → Pages → Build and deployment → Source에서 GitHub Actions를 선택합니다. main 브랜치에 푸시하거나 Actions의 Deploy React App to GitHub Pages 워크플로를 수동 실행하면 React 소스에서 새로 빌드하여 배포합니다. NAS 또는 웹포털은 필요하지 않습니다.

## 로컬 실행

Node.js 22 환경에서 `npm ci` 후 `npm start`를 실행합니다. `npm run build`로 정적 파일을 생성합니다.

학생 명단은 브라우저 로컬 저장소에 저장되며 NAS 주소와 GitHub Pages 주소 간 자동 이전되지 않습니다.
