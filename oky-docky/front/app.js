// demo data (mock)
const FORMS = [
  {
    id: 'w4',
    title: 'W-4',
    tags: ['Employment', 'Tax', 'USA']
  },
  {
    id: 'ack',
    title: 'USA Acknowledgment',
    tags: ['Notary', 'USA']
  },
  {
    id: 'ex1',
    title: 'Example docky',
    tags: ['Tag', 'General', 'Demo']
  },
  {
    id: 'ex2',
    title: 'Example docky 2',
    tags: ['Tag', 'Demo', 'Misc']
  },
  {
    id: 'w9',
    title: 'W-9',
    tags: ['Tax', 'Vendor', 'USA']
  },
  {
    id: 'i9',
    title: 'I-9',
    tags: ['Employment', 'Verification', 'USA']
  }
];

// render helpers
const $cards = document.getElementById('cards');
const $search = document.getElementById('search');
document.getElementById('year').textContent = new Date().getFullYear();

function cardTemplate({id, title, tags}) {
  return `
  <article class="card" data-id="${id}" tabindex="0" role="button" aria-label="Open ${title}">
    <h3 class="card__title">${title}</h3>
    <div class="card__media">
      <!-- stylized paper stack built with pure CSS -->
      <div class="paper-stack">
        <div class="paper-1 paper-lines"></div>
        <div class="paper-2 paper-lines"></div>
        <div class="paper-3 paper-lines"></div>
      </div>
    </div>
    <div class="card__tags">
      ${tags.slice(0,3).map(t => `<span class="tag">${t}</span>`).join('')}
    </div>
  </article>`;
}

function renderCards(list){
  $cards.innerHTML = list.map(cardTemplate).join('');
  // click -> (placeholder) open form page; for now just alert
  $cards.querySelectorAll('.card').forEach(el=>{
    el.addEventListener('click', ()=> {
      // здесь потом роут на /form/:id
      alert('Open form: ' + el.dataset.id);
    });
    el.addEventListener('keypress', (e)=>{ if(e.key==='Enter') el.click(); });
  });
}

renderCards(FORMS);

// search
function filterForms(q){
  q = q.trim().toLowerCase();
  if(!q) return FORMS;
  return FORMS.filter(f =>
    f.title.toLowerCase().includes(q) ||
    f.tags.some(t => t.toLowerCase().includes(q))
  );
}
$search.addEventListener('input', (e)=>{
  const q = e.target.value;
  renderCards(filterForms(q));
});
