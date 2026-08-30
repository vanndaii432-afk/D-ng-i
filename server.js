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
// Fixed Admin password requested for this build.
const ADMIN_PASSWORD = 'shopvinhzin';
const VCB_WEBHOOK_SECRET = process.env.VCB_WEBHOOK_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');


if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
for (const [file, initial] of [[ORDERS, []], [USERS, []], [KEYS, []]]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2));
}

const products = {
  panel_vip: {
    id:'panel_vip', category:'AIM PC', name:'PANEL VIP', type:'panel',
    description:'Panel tải miễn phí trước. Key theo thời hạn chỉ cấp sau khi thanh toán được xác nhận.',
    prices:{'1 Day':25000,'1 Tuần':130000,'1 Tháng':240000,'Vĩnh viễn':500000},
    panelFile:'/files/PANEL-VIP.zip'
  },
  aim_body_ios: {
    id:'aim_body_ios', category:'AIM IOS', name:'AIM BODY', type:'file', price:200000,
    description:'• đè Đầu cx đỏ\n• cân phòng\n• Ko nên đi rank', file:'/files/AIM-BODY-IOS.zip'
  }
};

function readJson(file){ try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return [];} }
function writeJson(file,data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }
function json(res,status,obj){
  const body=JSON.stringify(obj);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});
  res.end(body);
}
function parseBody(req){
  return new Promise((resolve,reject)=>{
    let s='';
    req.on('data',c=>{s+=c;if(s.length>1e6){req.destroy();reject(new Error('BODY_TOO_LARGE'));}});
    req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e);}});
    req.on('error',reject);
  });
}
function cookies(req){
  const out={};
  (req.headers.cookie||'').split(';').forEach(p=>{
    const i=p.indexOf('=');
    if(i>0) out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim());
  });
  return out;
}
function token(){return crypto.randomBytes(32).toString('hex');}
function signSession(username){
  const payload=Buffer.from(JSON.stringify({u:username,exp:Date.now()+7*24*60*60*1000})).toString('base64url');
  const sig=crypto.createHmac('sha256',SESSION_SECRET).update(payload).digest('base64url');
  return payload+'.'+sig;
}
function userFromReq(req){
  const raw=cookies(req).session||'';
  const [payload,sig]=raw.split('.');
  if(!payload||!sig) return null;
  const expected=crypto.createHmac('sha256',SESSION_SECRET).update(payload).digest('base64url');
  if(sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return null;
  try{const x=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')); if(!x.u||!x.exp||Date.now()>x.exp)return null; return {username:x.u};}catch{return null;}
}
function requireUser(req,res){
  const u=userFromReq(req);
  if(!u){json(res,401,{error:'LOGIN_REQUIRED'});return null;}
  return u;
}
function signAdminSession(){
  const payload=Buffer.from(JSON.stringify({admin:true,exp:Date.now()+7*24*60*60*1000})).toString('base64url');
  const sig=crypto.createHmac('sha256',SESSION_SECRET).update('admin.'+payload).digest('base64url');
  return payload+'.'+sig;
}
function adminFromReq(req){
  const cookie=cookies(req).admin||'';
  const [payload,sig]=cookie.split('.');
  if(!payload||!sig) return false;
  const expected=crypto.createHmac('sha256',SESSION_SECRET).update('admin.'+payload).digest('base64url');
  if(sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return false;
  try{const x=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')); return x.admin===true && x.exp>Date.now();}catch{return false;}
}
function requireAdmin(req,res){
  if(adminFromReq(req) || req.headers['x-admin-password']===ADMIN_PASSWORD) return true;
  json(res,401,{error:'UNAUTHORIZED'});
  return false;
}
function safeProduct(id){return products[id]||null;}
function amountFor(p,edition){return p.type==='panel'?(p.prices[edition]||0):p.price;}
function productPublic(p){
  const o={id:p.id,category:p.category,name:p.name,type:p.type,description:p.description};
  if(p.type==='panel'){o.prices=p.prices;o.panelFile=p.panelFile;}
  else{o.price=p.price;}
  return o;
}
function createOrder(user,productId,edition,forcedAmount=null){
  const p=safeProduct(productId);
  if(!p) throw new Error('Sản phẩm không tồn tại');
  if(p.type==='panel'&&!p.prices[edition]) throw new Error('Vui lòng chọn thời hạn key');
  const amount=forcedAmount===null?amountFor(p,edition):forcedAmount;
  const orders=readJson(ORDERS);
  const order={
    orderId:'TV'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(2).toString('hex').toUpperCase(),
    username:user.username, productId, product:p.name, category:p.category, edition:edition||'',
    amount, status:'PENDING', createdAt:new Date().toISOString(), download:false, key:null
  };
  orders.unshift(order); writeJson(ORDERS,orders); return order;
}
function issueKey(order){
  if(order.productId!=='panel_vip') return null;
  const keys=readJson(KEYS);
  const idx=keys.findIndex(k=>!k.used);
  if(idx<0){
    const generated='TV-'+crypto.randomBytes(5).toString('hex').toUpperCase()+'-'+crypto.randomBytes(5).toString('hex').toUpperCase();
    keys.push({key:generated,used:true,orderId:order.orderId});
    writeJson(KEYS,keys); return generated;
  }
  keys[idx].used=true; keys[idx].orderId=order.orderId;
  writeJson(KEYS,keys); return keys[idx].key;
}
function confirmOrder(orderId){
  const orders=readJson(ORDERS);
  const o=orders.find(x=>x.orderId===orderId);
  if(!o) throw new Error('Không tìm thấy đơn');
  if(o.status!=='PAID'){
    o.status='PAID'; o.paidAt=new Date().toISOString();
    o.key=issueKey(o);
    o.download=o.productId!=='panel_vip';
    writeJson(ORDERS,orders);
  }
  return o;
}
function staticFile(res, pathname){
  let p=pathname==='/'?path.join(PUBLIC,'index.html'):path.join(PUBLIC,pathname.replace(/^\/+/,''));
  const rel=path.relative(PUBLIC,p);
  if(rel.startsWith('..') || path.isAbsolute(rel)) return json(res,403,{error:'FORBIDDEN'});
  if(!fs.existsSync(p)||fs.statSync(p).isDirectory()) return json(res,404,{error:'NOT_FOUND'});
  const ext=path.extname(p).toLowerCase();
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.zip':'application/zip'};
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});
  fs.createReadStream(p).pipe(res);
}

const server=http.createServer(async (req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const p=u.pathname;
  try{
    if(req.method==='GET'&&p==='/health') return json(res,200,{ok:true,shop:'Trần Vinh'});
    if(req.method==='GET'&&p==='/api/products') return json(res,200,Object.fromEntries(Object.entries(products).map(([k,v])=>[k,productPublic(v)])));
    if(req.method==='GET'&&p==='/api/auth/me'){
      const user=userFromReq(req);
      return json(res,200,{authenticated:!!user,user:user?{username:user.username}:null});
    }
    if(req.method==='POST'&&p==='/api/auth/register'){
      const b=await parseBody(req);
      const username=String(b.username||'').trim();
      const password=String(b.password||'');
      if(username.length<3||password.length<4) return json(res,400,{error:'Tên đăng nhập tối thiểu 3 ký tự, mật khẩu tối thiểu 4 ký tự.'});
      const users=readJson(USERS);
      if(users.some(x=>x.username.toLowerCase()===username.toLowerCase())) return json(res,409,{error:'Tài khoản đã tồn tại.'});
      users.push({username,passwordHash:crypto.createHash('sha256').update(password).digest('hex'),createdAt:new Date().toISOString()});
      writeJson(USERS,users);
      const t=signSession(username);
      res.setHeader('Set-Cookie',`session=${t}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=604800`);
      return json(res,200,{ok:true,user:{username}});
    }
    if(req.method==='POST'&&p==='/api/auth/login'){
      const b=await parseBody(req);
      const username=String(b.username||'').trim();
      const hash=crypto.createHash('sha256').update(String(b.password||'')).digest('hex');
      const user=readJson(USERS).find(x=>x.username===username&&x.passwordHash===hash);
      if(!user) return json(res,401,{error:'Sai tài khoản hoặc mật khẩu.'});
      const t=signSession(username);
      res.setHeader('Set-Cookie',`session=${t}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=604800`);
      return json(res,200,{ok:true,user:{username}});
    }
    if(req.method==='POST'&&p==='/api/auth/logout'){
      res.setHeader('Set-Cookie','session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0');
      return json(res,200,{ok:true});
    }

    if(req.method==='POST'&&p==='/api/orders'){
      const user=requireUser(req,res); if(!user)return;
      const b=await parseBody(req);
      try{
        const o=createOrder(user,String(b.productId||''),String(b.edition||''));
        return json(res,201,{orderId:o.orderId,amount:o.amount,status:o.status,product:o.product,edition:o.edition,transferContent:o.orderId});
      }catch(e){return json(res,400,{error:e.message});}
    }

    // Vietcombank/Open Banking webhook adapter. Configure VCB_WEBHOOK_SECRET
    // and point the approved bank/payment provider callback to this endpoint.
    if(req.method==='POST'&&p==='/api/payments/vietcombank'){
      if(!VCB_WEBHOOK_SECRET) return json(res,503,{error:'VCB_WEBHOOK_NOT_CONFIGURED'});
      const supplied=String(req.headers['x-webhook-secret']||'');
      const a=Buffer.from(supplied); const b=Buffer.from(VCB_WEBHOOK_SECRET);
      if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return json(res,401,{error:'INVALID_WEBHOOK_SECRET'});
      const body=await parseBody(req);
      const tx=body.transaction||body.data||body;
      const amount=Number(tx.amount ?? tx.creditAmount ?? tx.value ?? 0);
      const content=String(tx.content ?? tx.description ?? tx.transferContent ?? tx.addDescription ?? '').toUpperCase();
      const reference=String(tx.referenceNumber ?? tx.transactionCode ?? tx.transId ?? tx.id ?? '').trim();
      if(!amount || !content) return json(res,400,{error:'INVALID_TRANSACTION_PAYLOAD'});
      const orders=readJson(ORDERS);
      const orderIdMatch=content.match(/\b(TV[A-Z0-9]+)\b/);
      if(!orderIdMatch) return json(res,200,{ok:true,matched:false,reason:'ORDER_ID_NOT_FOUND'});
      const order=orders.find(o=>o.orderId===orderIdMatch[1]);
      if(!order) return json(res,200,{ok:true,matched:false,reason:'ORDER_NOT_FOUND'});
      if(order.status==='PAID') return json(res,200,{ok:true,matched:true,alreadyPaid:true,orderId:order.orderId});
      if(Number(order.amount)!==amount) return json(res,200,{ok:true,matched:false,reason:'AMOUNT_MISMATCH',orderId:order.orderId,expected:order.amount,received:amount});
      if(reference && orders.some(o=>o.paymentReference===reference && o.orderId!==order.orderId)) return json(res,409,{error:'DUPLICATE_TRANSACTION_REFERENCE'});
      order.status='PAID'; order.paidAt=new Date().toISOString(); order.paymentReference=reference||null;
      order.paymentSource='VIETCOMBANK_WEBHOOK'; order.key=issueKey(order); order.download=order.productId!=='panel_vip';
      writeJson(ORDERS,orders);
      return json(res,200,{ok:true,matched:true,orderId:order.orderId,status:order.status,key:order.key,download:order.download});
    }

    // Download route must be checked before the generic /api/orders/:id route.
    if(req.method==='GET'&&/^\/api\/orders\/[^/]+\/download$/.test(p)){
      const user=requireUser(req,res); if(!user)return;
      const id=decodeURIComponent(p.split('/')[3]||'');
      const o=readJson(ORDERS).find(x=>x.orderId===id&&x.username===user.username);
      if(!o||o.status!=='PAID') return json(res,403,{error:'Chưa được xác nhận thanh toán.'});
      const pr=products[o.productId];
      if(!pr||!pr.file) return json(res,400,{error:'Sản phẩm này không phải file tải.'});
      return staticFile(res,pr.file);
    }

    if(req.method==='GET'&&/^\/api\/orders\/[^/]+$/.test(p)){
      const user=requireUser(req,res); if(!user)return;
      const id=decodeURIComponent(p.split('/')[3]||'');
      const o=readJson(ORDERS).find(x=>x.orderId===id&&x.username===user.username);
      if(!o)return json(res,404,{error:'NOT_FOUND'});
      return json(res,200,{orderId:o.orderId,status:o.status,paid:o.status==='PAID',product:o.product,amount:o.amount,edition:o.edition,key:o.status==='PAID'?o.key:null,download:o.status==='PAID'&&o.productId!=='panel_vip'});
    }

    if(req.method==='GET'&&p==='/admin') return staticFile(res,'/admin.html');
    if(req.method==='GET'&&p==='/account') return staticFile(res,'/account.html');

    if(req.method==='POST'&&p==='/admin/api/login'){
      const b=await parseBody(req);
      if(String(b.password||'')!==ADMIN_PASSWORD) return json(res,401,{error:'Mật khẩu Admin không đúng.'});
      const t=signAdminSession();
      res.setHeader('Set-Cookie',`admin=${t}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=604800`);
      return json(res,200,{ok:true});
    }
    if(req.method==='POST'&&p==='/admin/api/logout'){
      res.setHeader('Set-Cookie','admin=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0');
      return json(res,200,{ok:true});
    }
    if(req.method==='GET'&&p==='/admin/api/me'){
      return json(res,200,{authenticated:adminFromReq(req)});
    }

    if(p.startsWith('/admin/api/')){
      if(!requireAdmin(req,res))return;
      if(req.method==='GET'&&p==='/admin/api/orders') return json(res,200,readJson(ORDERS));
      if(req.method==='POST'&&p==='/admin/api/orders/confirm'){
        const b=await parseBody(req);
        try{return json(res,200,confirmOrder(String(b.orderId||'')));}
        catch(e){return json(res,400,{error:e.message});}
      }
      if(req.method==='POST'&&p==='/admin/api/test-order'){
        const b=await parseBody(req);
        try{
          const fake={username:'ADMIN'};
          const o=createOrder(fake,String(b.productId||''),String(b.edition||''),0);
          const paid=confirmOrder(o.orderId);
          return json(res,200,{orderId:paid.orderId,status:paid.status,amount:0,key:paid.key});
        }catch(e){return json(res,400,{error:e.message});}
      }
      return json(res,404,{error:'NOT_FOUND'});
    }

    if(req.method==='GET') return staticFile(res,p);
    return json(res,405,{error:'METHOD_NOT_ALLOWED'});
  }catch(e){
    console.error(e);
    return json(res,500,{error:'SERVER_ERROR'});
  }
});
server.listen(PORT,()=>console.log(`Shop Trần Vinh listening on ${PORT}`));
