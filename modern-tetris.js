// 常量定義
const COLS = 10, ROWS = 22; // 顯示區20+2頂層buffer
const BLOCK = 24;
const colors = [
  null,
  "#00f0f0",  // I
  "#0000f0",  // J
  "#f0a000",  // L
  "#f0f000",  // O
  "#00f000",  // S
  "#a000f0",  // T
  "#f00000"   // Z
];
const PIECE_IDS = [1,2,3,4,5,6,7]; // I,J,L,O,S,T,Z

// SRS形狀
const SHAPES = {
  1: [ // I
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]
  ],
  2: [ // J
    [[2,0,0],[2,2,2],[0,0,0]],
    [[0,2,2],[0,2,0],[0,2,0]],
    [[0,0,0],[2,2,2],[0,0,2]],
    [[0,2,0],[0,2,0],[2,2,0]]
  ],
  3: [ // L
    [[0,0,3],[3,3,3],[0,0,0]],
    [[0,3,0],[0,3,0],[0,3,3]],
    [[0,0,0],[3,3,3],[3,0,0]],
    [[3,3,0],[0,3,0],[0,3,0]]
  ],
  4: [ // O
    [[4,4],[4,4]],
    [[4,4],[4,4]],
    [[4,4],[4,4]],
    [[4,4],[4,4]]
  ],
  5: [ // S
    [[0,5,5],[5,5,0],[0,0,0]],
    [[0,5,0],[0,5,5],[0,0,5]],
    [[0,0,0],[0,5,5],[5,5,0]],
    [[5,0,0],[5,5,0],[0,5,0]]
  ],
  6: [ // T
    [[0,6,0],[6,6,6],[0,0,0]],
    [[0,6,0],[0,6,6],[0,6,0]],
    [[0,0,0],[6,6,6],[0,6,0]],
    [[0,6,0],[6,6,0],[0,6,0]]
  ],
  7: [ // Z
    [[7,7,0],[0,7,7],[0,0,0]],
    [[0,0,7],[0,7,7],[0,7,0]],
    [[0,0,0],[7,7,0],[0,7,7]],
    [[0,7,0],[7,7,0],[7,0,0]]
  ]
};

// SRS Wall Kick (每個tetromino的kick表）
const SRS_KICKS = {
  'normal': [
    [[0,0],[ -1,0], [ -1,1], [ 0,-2], [ -1,-2]], // 0→R
    [[0,0],[ 1,0 ], [ 1,-1], [ 0,2 ], [ 1,2  ]], // R→0
    [[0,0],[ 1,0 ], [ 1,1 ], [ 0,-2], [ 1,-2 ]], // R→2
    [[0,0],[ -1,0], [ -1,-1],[ 0,2 ], [ -1,2 ]]  // 2→R
  ],
  'I': [
    [[0,0],[ -2,0], [ 1,0 ], [ -2,-1],[ 1,2 ]],
    [[0,0],[ 2,0 ], [ -1,0], [ 2,1 ], [ -1,-2]],
    [[0,0],[ -1,0], [ 2,0 ], [ -1,2 ],[ 2,-1 ]],
    [[0,0],[ 1,0 ], [ -2,0], [ 1,-2 ],[ -2,1 ]]
  ]
};

function getSRSKicks(id, from, to) {
  // O 不需要踢牆
  if (id === 4) return [[0,0]];
  let idx = 0;
  if (from === 0 && to === 1) idx = 0;
  else if (from === 1 && to === 0) idx = 1;
  else if (from === 1 && to === 2) idx = 2;
  else if (from === 2 && to === 1) idx = 3;
  else if (from === 2 && to === 3) idx = 0;
  else if (from === 3 && to === 2) idx = 1;
  else if (from === 3 && to === 0) idx = 2;
  else if (from === 0 && to === 3) idx = 3;
  if (id === 1) {
    return SRS_KICKS.I[idx];
  }
  return SRS_KICKS.normal[idx];
}

// 7-bag生成器
class Bag {
  constructor() {
    this.pool = [];
  }
  next() {
    if (this.pool.length === 0) {
      this.pool = PIECE_IDS.slice();
      for (let i = this.pool.length-1; i > 0; i--) {
        let j = Math.floor(Math.random()*(i+1));
        [this.pool[i], this.pool[j]] = [this.pool[j], this.pool[i]];
      }
    }
    return this.pool.pop();
  }
}

// 主 Tetris 遊戲
class Tetris {
  constructor(ctx, ghostCtx, nextCtx, holdCtx, ui) {
    this.ctx = ctx;
    this.ghostCtx = ghostCtx;
    this.nextCtx = nextCtx;
    this.holdCtx = holdCtx;
    this.ui = ui;

    this.reset();
    this._bindControls();
    this.run();
  }

  reset() {
    // ROWS 較多2行頂層buffer，方便SRS出生和lock判斷
    this.board = Array.from({length: ROWS},()=>Array(COLS).fill(0));
    this.score = 0;
    this.lines = 0;
    this.level = 0;
    this.combo = -1;
    this.b2b = false;
    this.spawnBag = new Bag();
    this.nexts = [];
    for (let i=0; i<5; i++) this.nexts.push(this.spawnBag.next());
    this.hold_piece = 0;
    this.hold_used = false;
    this.active = this._makePiece(this.nexts.shift());
    this.ghostY = 0;
    this.dropTime = performance.now();
    this.dropInterval = 666; // 速度依lines調整
    this.lockDelay = 320;
    this.lockTime = 0;
    this.lockPending = false;
    this.gameOver = false;
    this.ui.message.textContent = '';
    this.ui.overlay.style.display = 'none';
    this._draw();
    this._drawNext();
    this._drawHold();
  }

  _makePiece(type) {
    return {
      id: type,
      x: Math.floor(COLS/2) - (type===1 ? 2 : 1),
      y: -2,
      rot: 0,
      data: SHAPES[type][0],
      lastKick: null,
      isTSpin: false
    };
  }

  _bindControls() {
    document.onkeydown = e=>{
      if(this.gameOver) return;
      switch(e.code) {
        case "ArrowLeft":
        case "KeyA":
          this._move(-1); break;
        case "ArrowRight":
        case "KeyD":
          this._move(1); break;
        case "ArrowDown":
        case "KeyS":
          this._softDrop(); break;
        case "Space":
          this._hardDrop(); break;
        case "KeyC":
        case "ShiftLeft":
        case "ShiftRight":
          this._hold(); break;
        case "KeyZ":
          this._rotate(-1); break;
        case "KeyX":
        case "ArrowUp":
          this._rotate(1); break;
      }
    };
    // 行動版按鈕
    [
      ['left-btn', ()=>this._move(-1)],
      ['right-btn', ()=>this._move(1)],
      ['down-btn', ()=>this._softDrop()],
      ['rotate-btn', ()=>this._rotate(1)],
      ['harddrop-btn', ()=>this._hardDrop()],
      ['hold-btn', ()=>this._hold()]
    ].forEach(([id,fn])=>{
      let btn = document.getElementById(id);
      if(btn) btn.ontouchstart=btn.onmousedown=(e)=>{e.preventDefault(); fn();};
    });
    document.getElementById('restart').onclick=()=>this.reset();
  }

  run() {
    let step = () => {
      if (this.gameOver) return;
      let now = performance.now();
      // 自動下降
      if (!this.lockPending && now - this.dropTime > this._speed()) {
        if (!this._down()) {
          this.lockPending=true;
          this.lockTime=now;
        }
        this.dropTime = now;
      }
      // Lock delay
      if (this.lockPending && now - this.lockTime > this.lockDelay) {
        this._fixToBoard();
        this.lockPending = false;
      }
      this._draw();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  _speed() {
    let l=Math.floor(this.lines/10);
    // 速度table參考TETR.IO和Tetris99
    let table=[666,466,333,200,133,100,83,66,50,33,25,17];
    return table[l]||10;
  }

  _clonePiece(piece) {
    return {
      id:piece.id, x:piece.x, y:piece.y, rot:piece.rot,
      data:SHAPES[piece.id][piece.rot],
      lastKick:null, isTSpin:false
    };
  }

  // 下落
  _down() {
    let p=this._clonePiece(this.active); p.y++;
    if(!this._valid(p)) {
      return false;
    }
    this.active.y++;
    this._draw();
    return true;
  }
  _softDrop() {
    if(this._down()) this.score += 1;
  }
  _hardDrop() {
    let moved=0;
    while(this._down()) moved++;
    this.score+=moved*2;
    this.lockPending=true;
    this.lockTime=performance.now();
    this._draw();
  }
  _move(dir) {
    let p=this._clonePiece(this.active); p.x+=dir;
    if(this._valid(p)) {
      this.active.x+=dir;
      this.lockPending=false;
      this._draw();
    }
  }
  _hold() {
    if(this.hold_used) return;
    if(!this.hold_piece) {
      this.hold_piece = this.active.id;
      this.active = this._makePiece(this.nexts.shift());
      this.nexts.push(this.spawnBag.next());
    } else {
      let tmp = this.hold_piece;
      this.hold_piece = this.active.id;
      this.active = this._makePiece(tmp);
    }
    this.hold_used=true;
    this._drawHold();
    this._drawNext();
    this._draw();
  }
  // SRS旋轉
  _rotate(dir) {
    let ori = this.active.rot, ni = (ori+dir+4)%4;
    let base = this._clonePiece(this.active); base.rot=ni; base.data=SHAPES[this.active.id][ni];
    let kicks = getSRSKicks(this.active.id, ori, ni);
    for(let [dx,dy] of kicks) {
      base.x = this.active.x+dx; base.y = this.active.y+dy;
      if(this._valid(base)) {
        this.active.rot=ni;
        this.active.data=SHAPES[this.active.id][ni];
        this.active.x+=dx; this.active.y+=dy;
        this.active.lastKick=[dx,dy];
        this.lockPending=false;
        this._draw();
        return;
      }
    }
  }

  // 是否有效
  _valid(p) {
    let mat=p.data;
    for(let r=0;r<mat.length;++r)
      for(let c=0;c<mat[r].length;++c)
        if(mat[r][c]) {
          let x=p.x+c, y=p.y+r;
          if(x<0||x>=COLS||y>=ROWS||(y>=0&&this.board[y][x])) return false;
        }
    return true;
  }
  // 當前Piece投影位置
  _ghostYCalc() {
    let p=this._clonePiece(this.active), y=this.active.y;
    while(true) {
      p.y++;
      if(!this._valid(p)) break;
      y++;
    }
    return y;
  }

  // 鎖定
  _fixToBoard() {
    let p = this.active, mat=p.data;
    for(let r=0;r<mat.length;++r)
      for(let c=0;c<mat[r].length;++c)
        if(mat[r][c]) {
          let x=p.x+c, y=p.y+r;
          if(y>=0&&y<ROWS) this.board[y][x]=p.id;
        }
    // 判斷消行與分數
    let linesCleared = this._clearLines();
    // Combo/BackToBack分數
    if(linesCleared>0) {
      if(this.combo>=0) this.score+=50*this.combo;
      this.combo++;
      this.score+=[0,100,300,500,800][linesCleared];
      if(this._isSpecialClear(p,linesCleared))
        this.score+=400; // T-Spin/BackToBack加分
      if(linesCleared===4||p.isTSpin) this.b2b=true;
      else this.b2b=false;
    } else this.combo=-1;

    this.lines+=linesCleared;
    // 產生新方塊
    this.active = this._makePiece(this.nexts.shift());
    this.nexts.push(this.spawnBag.next());
    this.hold_used = false;
    // 檢查Game Over
    if(!this._valid(this.active)) {
      this.gameOver = true;
      this.ui.message.textContent = "Game Over!";
      this.ui.overlay.style.display = 'flex';
    }
    this._drawNext();
    this._drawHold();
    this._draw();
  }

  // 消行
  _clearLines() {
    let cnt = 0;
    for(let y=ROWS-1;y>=0;y--) {
      if(this.board[y].every(v=>v)) {
        this.board.splice(y,1);
        this.board.unshift(Array(COLS).fill(0));
        cnt++;
        y++;
      }
    }
    return cnt;
  }

  // 判定T-Spin/BackToBack
  _isSpecialClear(p,lc) {
    // 這裡僅判定T-Spin（超精確判定可再改進）
    if(p.id===6&&p.lastKick) { // T形+kick
      let mat=p.data, corners=0, {x,y}=p;
      [[0,0],[0,mat.length-1],[mat.length-1,0],[mat.length-1,mat.length-1]].forEach(([r,c])=>{
        let bx=x+c, by=y+r;
        if(by<0||by>=ROWS||bx<0||bx>=COLS||this.board[by][bx]) corners++;
      });
      if(corners>=3) {p.isTSpin=true; return true;}
    }
    // B2B (大方塊消四行)
    if(p.id===1&&lc===4) return true;
    return false;
  }

  // 畫圖
  _draw() {
    this.ctx.clearRect(0,0,COLS*BLOCK,20*BLOCK);
    // 只顯示底下20行, 不含buffer
    for(let y=2;y<ROWS;++y)
      for(let x=0;x<COLS;++x)
        if(this.board[y][x]) this._drawBlock(this.ctx,x,y-2,colors[this.board[y][x]]);
    // 畫方塊
    let p=this.active,mat=p.data;
    for(let r=0;r<mat.length;++r)
      for(let c=0;c<mat[r].length;++c)
        if(mat[r][c]) {
          let x=p.x+c, y=p.y+r-2;
          if(y>=0) this._drawBlock(this.ctx,x,y,colors[p.id]);
        }
    // Ghost Piece
    let gy = this._ghostYCalc()-2;
    this.ghostCtx.clearRect(0,0,COLS*BLOCK,20*BLOCK);
    for(let r=0;r<mat.length;++r)
      for(let c=0;c<mat[r].length;++c)
        if(mat[r][c]) {
          let x=p.x+c, y=gy+r;
          if(y>=0)
            this._drawGhostBlock(this.ghostCtx,x,y,colors[p.id]);
        }
    // UI
    this.ui.score.textContent=this.score;
    this.ui.lines.textContent=this.lines;
  }
  _drawBlock(ctx,x,y,color) {
    ctx.fillStyle=color;
    ctx.fillRect(x*BLOCK+1,y*BLOCK+1,BLOCK-2,BLOCK-2);
    ctx.strokeStyle="#333";
    ctx.strokeRect(x*BLOCK,y*BLOCK,BLOCK,BLOCK);
  }
  _drawGhostBlock(ctx,x,y,color) {
    ctx.globalAlpha=0.3;
    this._drawBlock(ctx,x,y,color);
    ctx.globalAlpha=1;
  }

  _drawNext() {
    this.nextCtx.clearRect(0,0,80,140);
    for(let i=0;i<3;i++) {
      let type=this.nexts[i], mat=SHAPES[type][0], color=colors[type];
      let pos=[20,10+i*40];
      for(let r=0;r<mat.length;r++)
        for(let c=0;c<mat[r].length;c++)
          if(mat[r][c])
            this._drawBlock(this.nextCtx,pos[0]+c*16,pos[1]+r*16,color);
    }
  }
  _drawHold() {
    this.holdCtx.clearRect(0,0,80,80);
    if(!this.hold_piece) return;
    let type=this.hold_piece, mat=SHAPES[type][0], color=colors[type];
    for(let r=0;r<mat.length;r++)
      for(let c=0;c<mat[r].length;c++)
        if(mat[r][c])
          this._drawBlock(this.holdCtx,14+c*16,14+r*16,color);
  }
}

// 啟動
window.onload=function(){
  let canvas=document.getElementById("tetris");
  canvas.width=COLS*BLOCK; canvas.height=20*BLOCK;
  let ghost=document.getElementById("ghost");
  ghost.width=COLS*BLOCK; ghost.height=20*BLOCK;
  let next=document.getElementById("next");
  let hold=document.getElementById("hold");
  let ui={
    score:document.getElementById("score"),
    lines:document.getElementById("lines"),
    overlay:document.getElementById("overlay"),
    message:document.getElementById("message")
  };
  new Tetris(
    canvas.getContext("2d"),
    ghost.getContext("2d"),
    next.getContext("2d"),
    hold.getContext("2d"),
    ui
  );
};
