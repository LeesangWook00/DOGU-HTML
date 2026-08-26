// 로컬 전용 테스트 스크립트. Apps Script 배포 전에 토큰/계정이 맞는지 빠르게 확인용.
// 사용법: backend/.env 파일에 JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN 채운 뒤
//   node backend/test-jira-connection.js
// .env는 .gitignore에 등록되어 커밋되지 않음. Node 18 이상 필요 (내장 fetch 사용).

const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const env = {};
  const content = fs.readFileSync(file, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  });
  return env;
}

async function main() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    console.error("backend/.env 파일이 없습니다. backend/.env.example을 복사해서 값을 채워주세요.");
    process.exit(1);
  }
  const env = loadEnv(envPath);
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = env;
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error("JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN 중 비어있는 값이 있습니다.");
    process.exit(1);
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

  console.log("1) 토큰/계정 확인 (myself)");
  const meRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/myself`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }
  });
  console.log("   상태 코드:", meRes.status);
  if (!meRes.ok) {
    console.error("   토큰 또는 이메일이 올바르지 않습니다. 응답:", await meRes.text());
    process.exit(1);
  }
  const me = await meRes.json();
  console.log("   인증된 계정:", me.displayName, `(${me.emailAddress})`);

  const searchEmail = process.argv[2] || JIRA_EMAIL;
  console.log(`\n2) 사용자 검색 (query=${searchEmail})`);
  const searchRes = await fetch(
    `${JIRA_BASE_URL}/rest/api/3/user/search?query=${encodeURIComponent(searchEmail)}`,
    { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
  );
  console.log("   상태 코드:", searchRes.status);
  const users = await searchRes.json();
  if (!Array.isArray(users) || users.length === 0) {
    console.log("   일치하는 계정을 찾지 못했습니다.");
  } else {
    users.forEach((u) => {
      console.log(`   - ${u.displayName} / accountId=${u.accountId} / email=${u.emailAddress || "(비공개)"}`);
    });
  }
}

main().catch((err) => {
  console.error("실행 중 오류:", err);
  process.exit(1);
});
