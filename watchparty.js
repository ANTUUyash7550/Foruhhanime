(function(){
  const overlay = document.getElementById("wpOverlay");
  const setupView = document.getElementById("wpSetup");
  const roomView = document.getElementById("wpRoom");
  const titleEl = document.getElementById("wpTitle");
  const statusEl = document.getElementById("wpStatus");
  const startBtn = document.getElementById("wpStartBtn");
  const joinBtn = document.getElementById("wpJoinBtn");
  const joinInput = document.getElementById("wpJoinCode");
  const closeBtn = document.getElementById("wpClose");
  const leaveBtn = document.getElementById("wpLeaveBtn");
  const micBtn = document.getElementById("wpMicBtn");
  const codeChip = document.getElementById("wpCodeChip");
  const codeText = document.getElementById("wpCodeText");
  const copyBtn = document.getElementById("wpCopyCode");
  const connState = document.getElementById("wpConnState");
  const playerHost = document.getElementById("wpPlayer");

  let peer = null;
  let dataConn = null;
  let mediaCall = null;
  let localStream = null;
  let ytPlayer = null;
  let ytReady = false;
  let suppressSync = false;
  let isHost = false;
  let currentYoutubeId = null;
  let currentTitle = "";
  let micEnabled = true;

  function genCode(){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for(let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }

  function resetRoomUI(){
    setupView.hidden = false;
    roomView.hidden = true;
    statusEl.textContent = "";
    codeChip.hidden = true;
    connState.textContent = "Connecting…";
    joinInput.value = "";
  }

  // Public entry point. Called with (youtubeId, title) from a "watch together" button,
  // or with (null, "Watch party") from a generic "join a room" link.
  window.openWatchParty = function(youtubeId, title){
    currentYoutubeId = youtubeId || null;
    currentTitle = title || "Watch party";
    titleEl.textContent = currentTitle;
    startBtn.hidden = !currentYoutubeId;
    resetRoomUI();
    overlay.hidden = false;
  };

  function closeOverlay(){
    overlay.hidden = true;
    teardown();
  }
  closeBtn.addEventListener("click", closeOverlay);
  leaveBtn.addEventListener("click", closeOverlay);

  function teardown(){
    if(dataConn){ try{ dataConn.close(); }catch(e){} dataConn = null; }
    if(mediaCall){ try{ mediaCall.close(); }catch(e){} mediaCall = null; }
    if(localStream){ localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if(peer){ try{ peer.destroy(); }catch(e){} peer = null; }
    if(ytPlayer){ try{ ytPlayer.destroy(); }catch(e){} ytPlayer = null; }
    ytReady = false;
    isHost = false;
  }

  // --- YouTube IFrame API (loaded lazily, only when a watch party actually starts) ---
  let ytApiLoading = false;
  let ytApiCallbacks = [];
  function ensureYouTubeApi(cb){
    if(window.YT && window.YT.Player){ cb(); return; }
    ytApiCallbacks.push(cb);
    if(ytApiLoading) return;
    ytApiLoading = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = function(){
      ytApiCallbacks.forEach(f => f());
      ytApiCallbacks = [];
    };
  }

  function loadPlayer(videoId){
    setupView.hidden = true;
    roomView.hidden = false;
    playerHost.innerHTML = "";
    ensureYouTubeApi(() => {
      ytPlayer = new YT.Player("wpPlayer", {
        videoId,
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => { ytReady = true; },
          onStateChange: onPlayerStateChange
        }
      });
    });
  }

  function onPlayerStateChange(e){
    if(suppressSync || !dataConn || !dataConn.open) return;
    if(e.data === YT.PlayerState.PLAYING){
      sendSync({ type: "state", state: "play", time: ytPlayer.getCurrentTime() });
    }else if(e.data === YT.PlayerState.PAUSED){
      sendSync({ type: "state", state: "pause", time: ytPlayer.getCurrentTime() });
    }
  }

  function sendSync(msg){
    if(dataConn && dataConn.open) dataConn.send(msg);
  }

  function applyRemoteState(msg){
    if(!ytPlayer || !ytReady) return;
    suppressSync = true;
    const drift = Math.abs(ytPlayer.getCurrentTime() - msg.time);
    if(drift > 1.2) ytPlayer.seekTo(msg.time, true);
    if(msg.state === "play") ytPlayer.playVideo(); else ytPlayer.pauseVideo();
    setTimeout(() => { suppressSync = false; }, 600);
  }

  // --- Voice call ---
  async function getMic(){
    try{
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }catch(err){
      statusEl.textContent = "Mic access denied — you can still watch in sync, just without voice.";
      localStream = null;
    }
  }

  function attachRemoteAudio(stream){
    let audioEl = document.getElementById("wpRemoteAudio");
    if(!audioEl){
      audioEl = document.createElement("audio");
      audioEl.id = "wpRemoteAudio";
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
  }

  function wireDataConn(conn){
    dataConn = conn;
    dataConn.on("open", () => {
      connState.textContent = "Connected";
      if(isHost && currentYoutubeId){
        sendSync({ type: "init", youtubeId: currentYoutubeId, title: currentTitle });
      }
    });
    dataConn.on("data", data => {
      if(data.type === "init"){
        currentYoutubeId = data.youtubeId;
        titleEl.textContent = data.title || "Watch party";
        loadPlayer(currentYoutubeId);
      }else if(data.type === "state"){
        applyRemoteState(data);
      }
    });
    dataConn.on("close", () => { connState.textContent = "Your person left the room."; });
  }

  micBtn.addEventListener("click", () => {
    micEnabled = !micEnabled;
    if(localStream) localStream.getAudioTracks().forEach(t => t.enabled = micEnabled);
    micBtn.textContent = micEnabled ? "🎤" : "🔇";
  });

  copyBtn.addEventListener("click", () => {
    navigator.clipboard?.writeText(codeText.textContent);
    copyBtn.textContent = "copied";
    setTimeout(() => copyBtn.textContent = "copy", 1200);
  });

  // --- Start a room (host) ---
  startBtn.addEventListener("click", async () => {
    if(!currentYoutubeId) return;
    isHost = true;
    statusEl.textContent = "Setting up your room…";
    await getMic();
    const code = genCode();
    peer = new Peer("fhanime-" + code, { debug: 0 });

    peer.on("open", () => {
      codeText.textContent = code;
      codeChip.hidden = false;
      loadPlayer(currentYoutubeId);
      connState.textContent = "Share the code — waiting for your person…";
    });

    peer.on("connection", conn => wireDataConn(conn));

    peer.on("call", call => {
      call.answer(localStream || undefined);
      mediaCall = call;
      call.on("stream", remoteStream => attachRemoteAudio(remoteStream));
    });

    peer.on("error", err => {
      statusEl.textContent = "Connection error — try again (" + err.type + ").";
    });
  });

  // --- Join a room (guest) ---
  joinBtn.addEventListener("click", async () => {
    const code = joinInput.value.trim().toUpperCase();
    if(!code){ statusEl.textContent = "Enter the code your person shared with you."; return; }
    isHost = false;
    statusEl.textContent = "Joining…";
    await getMic();
    peer = new Peer({ debug: 0 });

    peer.on("open", () => {
      const hostId = "fhanime-" + code;
      wireDataConn(peer.connect(hostId));

      const call = peer.call(hostId, localStream || undefined);
      mediaCall = call;
      call.on("stream", remoteStream => attachRemoteAudio(remoteStream));

      roomView.hidden = false;
      setupView.hidden = true;
      connState.textContent = "Connecting to your person…";
    });

    peer.on("error", err => {
      statusEl.textContent = "Couldn't find that room — check the code (" + err.type + ").";
    });
  });

  // Generic "join a watch party" entry point, wired from a footer link if present.
  const genericJoinLink = document.getElementById("wpJoinLink");
  if(genericJoinLink){
    genericJoinLink.addEventListener("click", e => {
      e.preventDefault();
      window.openWatchParty(null, "Watch party");
    });
  }
})();
