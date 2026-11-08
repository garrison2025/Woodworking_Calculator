// Homepage-only behavior. This module never imports calculator engines or
// requests the full tool registry: the directory is already prerendered HTML.
const directory=document.querySelector("#tool-directory");
const search=document.querySelector("#tool-search");
const searchStatus=document.querySelector("#tool-search-status");
const emptyState=document.querySelector("#tool-search-empty");
const clearSearch=document.querySelector("#tool-search-clear");
const panel=document.querySelector("#recent-tools");
const links=document.querySelector("#recent-links");
const clear=document.querySelector("#clear-recent-tools");

if(directory){
  const entries=[...directory.querySelectorAll("a")];
  if(panel&&links){
    // Reuse the exact existing destination and title from the server-rendered
    // directory. No second registry, network request or user tracking needed.
    const bySlug=new Map(entries.map(anchor=>[
      anchor.getAttribute("href").split("/")[1],anchor
    ]));
    try{
      const raw=JSON.parse(localStorage.getItem("woodwork-recent")||"[]");
      const saved=Array.isArray(raw)?raw:[];
      for(const slug of saved.slice(0,6)){
        const source=bySlug.get(slug);
        if(!source)continue;
        const anchor=document.createElement("a");
        anchor.href=source.getAttribute("href");
        anchor.textContent=(source.querySelector("span")?.textContent||source.textContent).trim()+" ↗";
        links.appendChild(anchor);
      }
      panel.hidden=!links.children.length;
    }catch{/* History is optional, including when storage is blocked. */}
    clear?.addEventListener("click",()=>{
      try{localStorage.removeItem("woodwork-recent")}catch{}
      links.replaceChildren();
      panel.hidden=true;
    });
  }
  if(search&&searchStatus){
    const words=text=>text.toLowerCase().match(/[a-z0-9]+/g)||[];
    const index=entries.map(item=>({
      item,terms:item.dataset.searchTerms.split("|").map(words)
    }));
    const filterTools=()=>{
      const query=words(search.value);
      let visible=0;
      for(const {item,terms} of index){
        const matched=terms.some(term=>query.every(word=>term.some(token=>token.startsWith(word))));
        item.hidden=!matched;
        if(matched)visible++;
      }
      searchStatus.textContent=visible===0?
        "No matching calculator. Try another task.":
        `Showing ${visible} of ${entries.length} tools`;
      // Keep the existing server-rendered link directory authoritative:
      // empty-state feedback adds no extra or duplicate SEO routes.
      if(emptyState)emptyState.hidden=visible!==0;
      directory.classList.toggle("is-filtering",query.length>0);
    };
    clearSearch?.addEventListener("click",()=>{
      search.value="";
      filterTools();
      search.focus();
    });
    search.addEventListener("input",filterTools);
    search.addEventListener("search",filterTools);
    filterTools();
  }
}


// Quick calculator lookup: '/' focuses search; Escape clears the active
// query. Never hijack keystrokes inside text fields or contenteditable nodes.
if(search){
  document.addEventListener("keydown",event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.defaultPrevented)return;
    const target=event.target;
    const typing=target instanceof Element &&
      Boolean(target.closest('input,textarea,select,[contenteditable="true"]'));
    if(event.key==="/"&&!typing){
      event.preventDefault();
      search.focus();
      search.select();
    }else if(event.key==="Escape"&&document.activeElement===search&&search.value){
      event.preventDefault();
      search.value="";
      search.dispatchEvent(new Event("input",{bubbles:true}));
    }
  });
}

// Scroll reveals apply only with motion consent, IntersectionObserver support
// and visible page elements; content stays fully readable without JavaScript.
// No scroll listener, timers, external libraries or layout-changing animations.
if(typeof IntersectionObserver!=="undefined" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
  const targets=document.querySelectorAll(
    ".home-section .section-heading, .home-section .tool-card, .trust-strip > div, .hero-graphic"
  );
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    }
  },{threshold:.06,rootMargin:"0px 0px -12px 0px"});
  for(const element of targets){
    element.classList.add("reveal-ready");
    observer.observe(element);
  }
}
