(function(){
  // Utility to get/set board state (assumes appState global)
  function getBoardState(){
    return window.appState ? JSON.stringify(window.appState) : JSON.stringify({});
  }
  function setBoardState(json){
    try{
      var state = JSON.parse(json);
      if(window.appState){
        Object.assign(window.appState, state);
        if(typeof render === 'function') render();
      }
    }catch(e){ console.error('Failed to restore board state', e); }
  }

  // Save button
  var btnSave = document.getElementById('btnSave');
  if(btnSave){
    btnSave.addEventListener('click', function(){
      localStorage.setItem('tact2_savedBoard', getBoardState());
      alert('Board saved locally. It will load automatically next time.');
    });
  }

  // Load on start
  window.addEventListener('load', function(){
    var saved = localStorage.getItem('tact2_savedBoard');
    if(saved){ setBoardState(saved); console.log('Loaded saved board'); }
    loadPlaybookList();
    // Restore colours
    var col = localStorage.getItem('tact2_teamColours');
    if(col){
      try{ var o = JSON.parse(col); document.documentElement.style.setProperty('--team-primary', o.primary); document.documentElement.style.setProperty('--team-secondary', o.secondary); document.getElementById('teamPrimary').value = o.primary; document.getElementById('teamSecondary').value = o.secondary; }catch(e){}
    }
  });

  // Export PNG
  var btnExport = document.getElementById('btnExport');
  if(btnExport){
    btnExport.addEventListener('click', function(){
      var canvas = document.querySelector('canvas');
      if(!canvas){ alert('No canvas found'); return; }
      var dataURL = canvas.toDataURL('image/png');
      var a = document.createElement('a'); a.href = dataURL; a.download = 'tact2_'+new Date().toISOString().slice(0,10)+'.png'; a.click();
    });
  }

  // Team colours
  var applyBtn = document.getElementById('applyTeamColours');
  if(applyBtn){
    applyBtn.addEventListener('click', function(){
      var primary = document.getElementById('teamPrimary').value;
      var secondary = document.getElementById('teamSecondary').value;
      document.documentElement.style.setProperty('--team-primary', primary);
      document.documentElement.style.setProperty('--team-secondary', secondary);
      localStorage.setItem('tact2_teamColours', JSON.stringify({primary:primary, secondary:secondary}));
      alert('Team colours applied');
    });
  }

  // Playbook management
  var playbookKey = 'tact2_playbook';
  var playbookListEl = document.getElementById('playbookList');
  var savePlayBtn = document.getElementById('savePlaybook');
  var nameInput = document.getElementById('playbookName');
  function loadPlaybookList(){
    var raw = localStorage.getItem(playbookKey) || '[]';
    var list = JSON.parse(raw);
    playbookListEl.innerHTML = '';
    list.forEach(function(item, idx){
      var li = document.createElement('li'); li.textContent = item.name; li.style.cursor='pointer';
      li.addEventListener('click', function(){ setBoardState(item.state); });
      var del = document.createElement('button'); del.textContent='✕'; del.style.marginLeft='6px';
      del.addEventListener('click', function(e){ e.stopPropagation(); list.splice(idx,1); localStorage.setItem(playbookKey, JSON.stringify(list)); loadPlaybookList(); });
      li.appendChild(del);
      playbookListEl.appendChild(li);
    });
  }
  if(savePlayBtn){
    savePlayBtn.addEventListener('click', function(){
      var name = nameInput.value.trim(); if(!name){ alert('Enter a name'); return; }
      var state = getBoardState();
      var list = JSON.parse(localStorage.getItem(playbookKey) || '[]');
      list.push({name:name, state:state});
      localStorage.setItem(playbookKey, JSON.stringify(list));
      loadPlaybookList();
      nameInput.value='';
      alert('Saved to Playbook');
    });
  }
})();