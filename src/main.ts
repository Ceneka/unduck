import type { User } from "firebase/auth";
import { auth, getBangsFromFirestore, onAuthStateChanged } from "./auth";
import { bangs } from "./bang";
import "./global.css";

let currentUser: User | null = null;
let selectedBangsMap = new Map<string, any>(
  JSON.parse(localStorage.getItem("selected-bangs") || "[]"),
);

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    selectedBangsMap = await getBangsFromFirestore();
  }
});

function noSearchDefaultPageRender() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
      <div class="content-container">
        <h1>Und*ck</h1>
        <p>DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables <a href="https://duckduckgo.com/bang.html" target="_blank">all of DuckDuckGo's bangs.</a></p>
        <div class="url-container"> 
          <input 
            type="text" 
            class="url-input"
            value="https://unduckk.pages.dev?q=%s"
            readonly 
          />
          <button class="copy-button">
            <img src="/clipboard.svg" alt="Copy" />
          </button>
        </div>
      </div>
      <footer class="footer">
        <a href="/bang.html">Customize Bangs</a>
        •
        <a href="https://t3.chat" target="_blank">t3.chat</a>
        •
        <a href="https://x.com/theo" target="_blank">theo</a>
        •
        <a href="https://github.com/t3dotgg/unduck" target="_blank">github</a>
      </footer>
    </div>
  `;

  const copyButton = app.querySelector<HTMLButtonElement>(".copy-button")!;
  const copyIcon = copyButton.querySelector("img")!;
  const urlInput = app.querySelector<HTMLInputElement>(".url-input")!;

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    copyIcon.src = "/clipboard-check.svg";

    setTimeout(() => {
      copyIcon.src = "/clipboard.svg";
    }, 2000);
  });
}

const LS_DEFAULT_BANG = localStorage.getItem("default-bang") ?? "gwt";

function getBangredirectUrl() {
  const url = new URL(window.location.href);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    noSearchDefaultPageRender();
    return null;
  }

  const match = query.match(/!(\S+)/i);
  const bangCandidate = match?.[1]?.toLowerCase() ?? LS_DEFAULT_BANG;

  if (!currentUser) {
    selectedBangsMap = new Map<string, any>(
      JSON.parse(localStorage.getItem("selected-bangs") || "[]"),
    );
  }

  let selectedBang;

  if (bangCandidate && selectedBangsMap.has(bangCandidate)) {
    selectedBang = selectedBangsMap.get(bangCandidate);
  } else {
    selectedBang = bangs.find((b) => b.t === bangCandidate);
  }

  if (!selectedBang) {
    selectedBang = bangs.find((b) => b.t === LS_DEFAULT_BANG);
  }

  // Remove the first bang from the query
  const cleanQuery = query.replace(/!\S+\s*/i, "").trim();

  // If the query is just `!gh`, use `github.com` instead of `github.com/search?q=`
  if (cleanQuery === "")
    return selectedBang ? `https://${selectedBang.d}` : null;

  // Format of the url is:
  // https://www.google.com/search?q={{{s}}}
  const searchUrl = selectedBang?.u.replace(
    "{{{s}}}",
    // Replace %2F with / to fix formats like "!ghr+t3dotgg/unduck"
    encodeURIComponent(cleanQuery).replace(/%2F/g, "/"),
  );
  if (!searchUrl) return null;

  return searchUrl;
}

function doRedirect() {
  const searchUrl = getBangredirectUrl();
  if (!searchUrl) return;
  window.location.replace(searchUrl);
}

doRedirect();
