const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const ORDERS = path.join(DATA, 'orders.json');
const USERS = path.join(DATA, 'users.json');
const KEYS = path.join(DATA, 'keys.json');
const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tranvinhzin';

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
for (const [file, initial] of [[ORDERS, []], [USERS, []], [KEYS, []]]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2));
}

const products = {
  panel_vip: {
    id:'panel_vip', category:'AIM PC', name:'PANEL VIP', type:'panel',
    description:'Panel VIP cho PC. Chọn thời hạn key sau khi thanh toán.',
    prices:{'1 Day':25000,'1 Tuần':130000,'1 Tháng':240000,'Vĩnh viễn':500000},
    panelFile:'/files/PANEL-VIP.zip'
  },
  aim_body_ios: {
    id:'aim_body_ios', category:'AIM IOS', name:'AIM BODY', type:'file', price:200000,
    description:'• đè Đâu cx đỏ\n• cân phòng\n• Ko nên đi rank', file:'/files/AIM-BODY-IOS.zip'
  },
  dvi_xanh_adr: {
    id:'dvi_xanh_adr', category:'AIM ADR', name:'DVI XANH - Keo Mờ', type:'file', price:70000,
    description:'• cân Rank\n• Cân phòng', file:'/files/DVI-XANH-KEO-MO-ADR.zip'
  }
};

function readJson(file){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return [];} }
function writeJson(file,data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }
function json(res,status,obj){ const body=JSON.stringify(obj); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)}); res.end(body); }
function parseBody(req){ return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6) req.destroy();});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});req.on('error',reject);}); }
function cookies(req){const out={};(req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return out;}
function token(){return crypto.randomBytes(24).toString('hex');}
const sessions=new Map();
function userFromReq(req){const t=cookies(req).session;return t?sessions.get(t):null;}
function requireUser(req,res){const u=userFromReq(req);if(!u){json(res,401,{error:'LOGIN_REQUIRED'});return null;}return u;}
function requireAdmin(req,res){if(req.headers['x-admin-password']!==ADMIN_PASSWORD){json(res,401,{error:'UNAUTHORIZED'});return false;}return true;}
function safeProduct(id){return products[id]||null;}
function amountFor(p,edition){return p.type==='panel'?(p.prices[edition]||0):p.price;}
function productPublic(p){const o={id:p.id,category:p.category,name:p.name,type:p.type,description:p.description};if(p.type==='panel'){o.prices=p.prices;o.panelFile=p.panelFile;}else{o.price=p.price;}return o;}
function createOrder(user,productId,edition){
  const p=safeProduct(productId); if(!p) throw new Error('Sản phẩm không tồn tại');
  if(p.type==='panel'&&!p.prices[edition]) throw new Error('Vui lòng chọn thời hạn key');
  const orders=readJson(ORDERS); const order={orderId:'TV'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(2).toString('hex').toUpperCase(),username:user.username,productId,product:p.name,category:p.category,edition:edition||'',amount:amountFor(p,edition),status:'PENDING',createdAt:new Date().toISOString(),download:false,key:null};
  orders.unshift(order); writeJson(ORDERS,orders); return order;
}
function issueKey(order){
  if(order.productId!=='panel_vip') return null;
  const keys=readJson(KEYS);
  let idx=keys.findIndex(k=>!k.used);
  if(idx<0){
    const generated='TV-'+crypto.randomBytes(5).toString('hex').toUpperCase()+'-'+crypto.randomBytes(5).toString('hex').toUpperCase();
    keys.push({key:generated,used:true,orderId:order.orderId}); writeJson(KEYS,keys); return generated;
  }
  keys[idx].used=true; keys[idx].orderId=order.orderId; writeJson(KEYS,keys); return keys[idx].key;
}
function confirmOrder(orderId){
  const orders=readJson(ORDERS); const o=orders.find(x=>x.orderId===orderId); if(!o) throw new Error('Không tìm thấy đơn');
  if(o.status!=='PAID'){o.status='PAID';o.paidAt=new Date().toISOString();o.key=issueKey(o);o.download=true;writeJson(ORDERS,orders);}return o;
}
function staticFile(res, pathname){
  let p=pathname==='/'?path.join(PUBLIC,'index.html'):path.join(PUBLIC,pathname.replace(/^\/+/,''));
  if(!p.startsWith(PUBLIC)) return json(res,403,{error:'FORBIDDEN'});
  if(!fs.existsSync(p)||fs.statSync(p).isDirectory()) return json(res,404,{error:'NOT_FOUND'});
  const ext=path.extname(p).toLowerCase(); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.zip':'application/zip'};
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'}); fs.createReadStream(p).pipe(res);
}

const server=http.createServer(async (req,res)=>{
  const u=new URL(req.url,'http://localhost'); const p=u.pathname;
  try{
    if(req.method==='GET'&&p==='/health') return json(res,200,{ok:true,shop:'Trần Vinh'});
    if(req.method==='GET'&&p==='/api/products') return json(res,200,Object.fromEntries(Object.entries(products).map(([k,v])=>[k,productPublic(v)])));
    if(req.method==='GET'&&p==='/api/auth/me'){const user=userFromReq(req);return json(res,200,{authenticated:!!user,user:user?{username:user.username}:null});}
    if(req.method==='POST'&&p==='/api/auth/register'){
      const b=await parseBody(req);const username=String(b.username||'').trim();const password=String(b.password||'');
      if(username.length<3||password.length<4)return json(res,400,{error:'Tên đăng nhập >= 3 ký tự, mật khẩu >= 4 ký tự'});
      const users=readJson(USERS);if(users.some(x=>x.username.toLowerCase()===username.toLowerCase()))return json(res,409,{error:'Tài khoản đã tồn tại'});
      users.push({username,passwordHash:crypto.createHash('sha256').update(password).digest('hex'),createdAt:new Date().toISOString()});writeJson(USERS,users);
      const t=token();sessions.set(t,{username});res.setHeader('Set-Cookie',`session=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);return json(res,200,{ok:true});
    }
    if(req.method==='POST'&&p==='/api/auth/login'){
      const b=await parseBody(req);const username=String(b.username||'').trim();const hash=crypto.createHash('sha256').update(String(b.password||'')).digest('hex');const user=readJson(USERS).find(x=>x.username===username&&x.passwordHash===hash);if(!user)return json(res,401,{error:'Sai tài khoản hoặc mật khẩu'});
      const t=token();sessions.set(t,{username});res.setHeader('Set-Cookie',`session=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);return json(res,200,{ok:true});
    }
    if(req.method==='POST'&&p==='/api/auth/logout'){const c=cookies(req);if(c.session)sessions.delete(c.session);res.setHeader('Set-Cookie','session=; HttpOnly; Path=/; Max-Age=0');return json(res,200,{ok:true});}
    if(req.method==='POST'&&p==='/api/orders'){
      const user=requireUser(req,res);if(!user)return;const b=await parseBody(req);let o;try{o=createOrder(user,b.productId,b.edition||'');}catch(e){return json(res,400,{error:e.message});}return json(res,201,{orderId:o.orderId,amount:o.amount,status:o.status,product:o.product,edition:o.edition});
    }
    if(req.method==='GET'&&p.startsWith('/api/orders/')){
      const user=requireUser(req,res);if(!user)return;const id=decodeURIComponent(p.split('/')[3]||'');const o=readJson(ORDERS).find(x=>x.orderId===id&&x.username===user.username);if(!o)return json(res,404,{error:'NOT_FOUND'});return json(res,200,{orderId:o.orderId,status:o.status,paid:o.status==='PAID',product:o.product,amount:o.amount,edition:o.edition,key:o.status==='PAID'?o.key:null,download:o.status==='PAID'});
    }
    if(req.method==='GET'&&p.startsWith('/api/orders/')&&p.endsWith('/download')){
      const user=requireUser(req,res);if(!user)return;const parts=p.split('/');const id=decodeURIComponent(parts[3]||'');const o=readJson(ORDERS).find(x=>x.orderId===id&&x.username===user.username);if(!o||o.status!=='PAID')return json(res,403,{error:'Chưa được xác nhận thanh toán'});const pr=products[o.productId];if(!pr||!pr.file)return json(res,400,{error:'Sản phẩm này không phải file tải'});return staticFile(res,pr.file);
    }
    if(req.method==='GET'&&p==='/admin') return staticFile(res,'/admin.html');
    if(req.method==='GET'&&p==='/account') return staticFile(res,'/account.html');
    if(p.startsWith('/admin/api/')){
      if(!requireAdmin(req,res))return;
      if(req.method==='GET'&&p==='/admin/api/orders')return json(res,200,readJson(ORDERS));
      if(req.method==='POST'&&p==='/admin/api/orders/confirm') {const b=await parseBody(req);try{return json(res,200,confirmOrder(b.orderId));}catch(e){return json(res,400,{error:e.message});}}
      if(req.method==='POST'&&p==='/admin/api/test-order'){const b=await parseBody(req);const fake={username:'ADMIN',...b};try{const o=createOrder(fake,b.productId,b.edition||'');const paid=confirmOrder(o.orderId);return json(res,200,{orderId:paid.orderId,status:paid.status,amount:0,key:paid.key});}catch(e){return json(res,400,{error:e.message});}}
      return json(res,404,{error:'NOT_FOUND'});
    }
    if(req.method==='GET') return staticFile(res,p);
    return json(res,405,{error:'METHOD_NOT_ALLOWED'});
  }catch(e){console.error(e);return json(res,500,{error:'SERVER_ERROR'});}
});
server.listen(PORT,()=>console.log(`Shop Trần Vinh listening on ${PORT}`));
