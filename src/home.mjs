// Homepage-only behavior. This module never imports calculator engines or
// requests the full tool registry: the directory is already prerendered HTML.
const directory=document.querySelector("#tool-directory");
const search=document.querySelector("#tool-search");
const searchStatus=document.querySelector("#tool-search-status");
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
    };
    search.addEventListener("input",filterTools);
    search.addEventListener("search",filterTools);
    filterTools();
  }
}
