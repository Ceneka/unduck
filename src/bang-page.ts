import type { User } from "firebase/auth";
import {
  auth,
  logOut,
  onAuthStateChanged,
  onBangsSnapshot,
  saveBangsToFirestore,
  signIn,
} from "./auth";
import { bangs } from "./bang";
import "./global.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

let currentUser: User | null = null;
let selectedBangs = new Map<string, any>(
  JSON.parse(localStorage.getItem("selected-bangs") || "[]"),
);
let unsubscribe: () => void = () => {};

app.innerHTML = `
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: start; min-height: 100vh; padding-top: 2rem; gap: 2rem;">
    <div id="auth-container">
      <button id="auth-btn">Login with Google</button>
    </div>
    <h1>Select Your Bangs</h1>
    
    <div id="custom-bang-form" class="custom-bang-form">
      <input type="text" id="custom-trigger" placeholder="!trigger" />
      <input type="text" id="custom-url" placeholder="https://example.com/?q={{{s}}}" />
      <button id="add-bang-btn">Add</button>
    </div>
      
    <h2>Selected Bangs</h2>
    <div id="selected-bangs" class="bang-grid"></div>
    
    <h2>All Bangs</h2>
    <input type="text" id="search-input" placeholder="Search for bangs..." style="width: 80%; max-width: 400px; padding: 0.5rem;" />
    <div id="all-bangs" class="bang-grid"></div>
  </div>
`;

const authContainer = document.getElementById("auth-container") as HTMLDivElement;
const searchInput = document.getElementById(
  "search-input",
) as HTMLInputElement;
const allBangsEl = document.getElementById("all-bangs")!;
const selectedBangsEl = document.getElementById("selected-bangs")!;

function updateAuthUI(user: User | null) {
  currentUser = user;
  if (user) {
    authContainer.innerHTML = `
      <span>Welcome, ${user.displayName}</span>
      <button id="auth-btn">Logout</button>
    `;
  } else {
    authContainer.innerHTML = `
      <button id="auth-btn">Login with Google</button>
    `;
  }
}

onAuthStateChanged(auth, (user: User | null) => {
  unsubscribe(); // Unsubscribe from previous listener
  updateAuthUI(user);
  if (user) {
    unsubscribe = onBangsSnapshot((bangs) => {
      selectedBangs = bangs;
      localStorage.setItem(
        "selected-bangs",
        JSON.stringify(Array.from(bangs.entries())),
      );
      renderBangs();
    });
  } else {
    selectedBangs = new Map(JSON.parse(localStorage.getItem("selected-bangs") || "[]"));
    renderBangs();
  }
});

function saveBangs() {
  if (currentUser) {
    saveBangsToFirestore(selectedBangs);
  } else {
    localStorage.setItem(
      "selected-bangs",
      JSON.stringify(Array.from(selectedBangs.entries())),
    );
  }
  renderBangs();
}

function renderBangs() {
  const filter = searchInput.value.toLowerCase();
  allBangsEl.innerHTML = "";
  selectedBangsEl.innerHTML = "";

  const fragmentAll = document.createDocumentFragment();
  const fragmentSelected = document.createDocumentFragment();

  bangs.forEach((bang) => {
    if (selectedBangs.has(bang.t)) {
      // This is to avoid showing selected bangs in the "All Bangs" list
      // when they have a custom trigger
      return;
    }

    let isSelected = false;
    for (const selectedBang of selectedBangs.values()) {
      if (selectedBang.d === bang.d && selectedBang.u === bang.u) {
        isSelected = true;
        break;
      }
    }

    if (isSelected) return;

    const bangEl = document.createElement("div");
    bangEl.className = "bang-item";
    bangEl.textContent = `!${bang.t}`;
    bangEl.dataset.trigger = bang.t;

    if (
      filter &&
      !bang.t.toLowerCase().includes(filter) &&
      !bang.d.toLowerCase().includes(filter)
    ) {
      return;
    }
    fragmentAll.appendChild(bangEl);
  });

  selectedBangs.forEach((_, trigger) => {
    const bangEl = document.createElement("div");
    bangEl.className = "bang-item selected";

    const textEl = document.createElement("span");
    textEl.className = "bang-text";
    textEl.textContent = `!${trigger}`;
    textEl.dataset.trigger = trigger;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = "&times;";
    removeBtn.dataset.trigger = trigger;

    bangEl.appendChild(textEl);
    bangEl.appendChild(removeBtn);
    fragmentSelected.appendChild(bangEl);
  });

  allBangsEl.appendChild(fragmentAll);
  selectedBangsEl.appendChild(fragmentSelected);
}

function toggleBangSelection(trigger: string) {
  const bang = bangs.find((b) => b.t === trigger);
  if (bang && !selectedBangs.has(trigger)) {
    selectedBangs.set(trigger, bang);
    saveBangs();
  }
}

function removeBang(trigger: string) {
  if (selectedBangs.has(trigger)) {
    selectedBangs.delete(trigger);
    saveBangs();
  }
}

function updateBangTrigger(oldTrigger: string, newTrigger: string) {
  if (!newTrigger || newTrigger === oldTrigger) {
    renderBangs();
    return;
  }

  if (selectedBangs.has(newTrigger) || bangs.some((b) => b.t === newTrigger)) {
    alert(`Bang !${newTrigger} already exists.`);
    renderBangs();
    return;
  }

  const bang = selectedBangs.get(oldTrigger);
  if (bang) {
    selectedBangs.delete(oldTrigger);
    const newBang = { ...bang, t: newTrigger };
    selectedBangs.set(newTrigger, newBang);
    saveBangs();
  } else {
    renderBangs();
  }
}

function addCustomBang() {
  const triggerInput = document.getElementById("custom-trigger") as HTMLInputElement;
  const urlInput = document.getElementById("custom-url") as HTMLInputElement;
  const trigger = triggerInput.value.replace(/^!/, "").trim();
  const url = urlInput.value.trim();

  if (!trigger || !url) {
    alert("Both trigger and URL are required.");
    return;
  }

  if (!url.includes("{{{s}}}")) {
    alert("URL must include `{{{s}}}` for the search query.");
    return;
  }

  if (selectedBangs.has(trigger) || bangs.some((b) => b.t === trigger)) {
    alert(`Bang !${trigger} already exists.`);
    return;
  }

  let domain = "";
  try {
    const urlObject = new URL(url.replace("{{{s}}}", "test"));
    domain = urlObject.hostname;
  } catch (error) {
    alert("Invalid URL format.");
    return;
  }

  const newBang = {
    t: trigger,
    d: domain,
    u: url,
    c: "custom", // To identify custom bangs
  };

  selectedBangs.set(trigger, newBang);
  saveBangs();

  triggerInput.value = "";
  urlInput.value = "";
}

app.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;

  if (target.id === "auth-btn") {
    if (currentUser) {
      logOut();
    } else {
      signIn();
    }
  }

  if (target.id === "add-bang-btn") {
    addCustomBang();
  }

  if (target.classList.contains("bang-item") && !target.classList.contains("selected")) {
    const trigger = target.dataset.trigger;
    if (trigger) {
      toggleBangSelection(trigger);
    }
  }

  if (target.classList.contains("remove-btn")) {
    const trigger = target.dataset.trigger;
    if (trigger) {
      removeBang(trigger);
    }
  }

  if (target.classList.contains("bang-text")) {
    const trigger = target.dataset.trigger;
    if (!trigger) return;

    const input = document.createElement("input");
    input.type = "text";
    input.value = trigger;
    target.replaceWith(input);
    input.focus();

    input.addEventListener("blur", () => {
      updateBangTrigger(trigger, input.value);
    });

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        input.blur();
      } else if (ev.key === "Escape") {
        renderBangs();
      }
    });
  }
});

searchInput.addEventListener("input", renderBangs);

renderBangs(); 
