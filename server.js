// PizzApp backend: zero dependencies (Node 16+). Orders persist to data.json.
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const STRICT = process.env.STRICT_HOURS === '1';
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB = path.join(DATA_DIR, 'data.json');
const PUB = path.join(__dirname, 'public');
const MENU = {sizes:{S:8,M:11,L:14},crusts:{thin:0,regular:0,deep:2},toppings:{pepperoni:1.5,ham:1.5,pineapple:1},deliveryFee:3};
const COUPONS={GOIRISH:0.10,KNOTT5:0.05};
const GAME_SATURDAYS=['2026-10-17','2026-10-31','2026-11-14'];
const STATUSES=['received','preparing','in_oven','ready','completed'];
const PREP_MINUTES=20;
const KITCHEN_KEY=process.env.KITCHEN_KEY||'';
const kitchenAllowed=req=>!KITCHEN_KEY||req.headers['x-kitchen-key']===KITCHEN_KEY;
let orders=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):[];
const save=()=>fs.writeFileSync(DB,JSON.stringify(orders,null,2));
const money=n=>Math.round(n*100)/100;
const phoneDigits=s=>String(s||'').replace(/\D/g,'');
const phoneMatches=(a,b)=>phoneDigits(a)===phoneDigits(b);
const publicOrder=o=>({id:o.id,items:o.items,fulfillment:o.fulfillment,address:o.address,total:o.total,payment:o.payment,status:o.status,history:o.history,createdAt:o.createdAt,feedback:o.feedback});
function isOpen(d=new Date()){const iso=d.toLocaleDateString('en-CA');if(d.getDay()===6&&GAME_SATURDAYS.includes(iso))return{open:false,why:'Closed on game Saturdays.'};if(d.getHours()<18)return{open:false,why:'We take orders 6pm to 12am.'};return{open:true}}
function priceItems(items){let subtotal=0;for(const it of items){if(!(it.size in MENU.sizes)||!(it.crust in MENU.crusts))throw new Error('Invalid size or crust.');const qty=Math.max(1,Math.min(10,parseInt(it.qty)||1));const tops=(it.toppings||[]).filter(t=>t in MENU.toppings);const each=MENU.sizes[it.size]+MENU.crusts[it.crust]+tops.reduce((s,t)=>s+MENU.toppings[t],0);it.qty=qty;it.toppings=tops;it.notes=String(it.notes||'').slice(0,300);it.lineTotal=money(each*qty);subtotal+=it.lineTotal}return money(subtotal)}
function createOrder(b){if(!Array.isArray(b.items)||!b.items.length)throw new Error('Add at least one pizza.');if(!b.name||!/^[\d\s()+-]{7,}$/.test(b.phone||''))throw new Error('Enter your name and a valid phone number.');if(STRICT){const o=isOpen();if(!o.open)throw new Error(o.why)}const delivery=b.fulfillment==='delivery';if(delivery&&!(/south bend/i.test(b.address||'')||/\b466\d\d\b/.test(b.address||'')))throw new Error('Delivery is only available within South Bend. Enter a South Bend address or choose pickup.');const subtotal=priceItems(b.items);const rate=COUPONS[String(b.coupon||'').toUpperCase()]||0;const discount=money(subtotal*rate),fee=delivery?MENU.deliveryFee:0;const now=new Date().toISOString();const order={id:'P'+String(orders.length+1).padStart(3,'0'),name:String(b.name).slice(0,60),phone:b.phone,items:b.items,fulfillment:delivery?'delivery':'pickup',address:delivery?String(b.address).slice(0,200):'',coupon:rate?b.coupon.toUpperCase():'',payment:b.payment==='card'?'card (mock, paid)':'pay at pickup/delivery',subtotal,discount,fee,total:money(subtotal-discount+fee),status:'received',history:{received:now},createdAt:now,feedback:null};orders.push(order);save();return order}
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj))};
const body=req=>new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>{try{r(JSON.parse(d||'{}'))}catch{r({})}})});
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://x'),p=url.pathname;try{
if(p==='/api/menu'&&req.method==='GET')return send(res,200,{...MENU,coupons:Object.keys(COUPONS).length,prepMinutes:PREP_MINUTES,status:isOpen(),strict:STRICT});
if(p==='/api/coupon'&&req.method==='GET'){const rate=COUPONS[(url.searchParams.get('code')||'').toUpperCase()];return send(res,200,{rate:rate||0})}
if(p==='/api/orders'&&req.method==='POST')return send(res,201,createOrder(await body(req)));
if(p==='/api/orders'&&req.method==='GET'){if(!kitchenAllowed(req))return send(res,401,{error:'Kitchen access code required.'});return send(res,200,{statuses:STATUSES,prepMinutes:PREP_MINUTES,orders});}
const tm=p.match(/^\/api\/track\/(\w+)$/);if(tm&&req.method==='GET'){const o=orders.find(x=>x.id===tm[1].toUpperCase());const phone=url.searchParams.get('phone')||'';if(!o||!phoneMatches(o.phone,phone))return send(res,404,{error:'We could not find that order. Check the order number and phone number.'});return send(res,200,publicOrder(o));}
const m=p.match(/^\/api\/orders\/(\w+)(\/status|\/feedback)?$/);if(m){const o=orders.find(x=>x.id===m[1]);if(!o)return send(res,404,{error:'Order not found.'});if(!m[2]&&req.method==='GET')return send(res,405,{error:'Use the order tracking form to view an order.'});if(m[2]==='/status'&&req.method==='PATCH'){if(!kitchenAllowed(req))return send(res,401,{error:'Kitchen access code required.'});const{status}=await body(req);if(!STATUSES.includes(status))return send(res,400,{error:'Invalid status.'});o.status=status;o.history[status]=new Date().toISOString();save();return send(res,200,o)}if(m[2]==='/feedback'&&req.method==='POST'){const{rating,comment,phone}=await body(req),r=parseInt(rating);if(!phoneMatches(o.phone,phone))return send(res,403,{error:'Order verification failed.'});if(o.status!=='completed')return send(res,400,{error:'You can rate once your order is complete.'});if(!(r>=1&&r<=5))return send(res,400,{error:'Rating must be 1 to 5.'});o.feedback={rating:r,comment:String(comment||'').slice(0,500)};save();return send(res,200,o)}}
let f=p==='/'?'/index.html':p==='/kitchen'?'/kitchen.html':p;const file=path.join(PUB,path.normalize(f));if(!file.startsWith(PUB)||!fs.existsSync(file)){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res)
}catch(e){send(res,400,{error:e.message})}}).listen(PORT,()=>console.log(`PizzApp running: customer http://localhost:${PORT}  kitchen http://localhost:${PORT}/kitchen`));
