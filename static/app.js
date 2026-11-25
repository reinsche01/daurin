const COLORS=["#1f7a5c","#c2410c","#1d4ed8","#a21caf","#b45309","#0e7490","#be123c","#4d7c0f","#6d28d9","#0f766e"];
const POIN={plastik:10,kertas:6,kaca:3,logam:12,elektronik:15};
const el=document.getElementById("map");
const map=L.map("map").setView([+el.dataset.lat,+el.dataset.lon],12);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap"}).addTo(map);
const layer=L.layerGroup().addTo(map);
const routeLayer=L.layerGroup().addTo(map);
let points=[],hasil=null,pilih=null,n=0,activeCluster=null;
const $=id=>document.getElementById(id);

function tampilRute(clusterIdx){
  routeLayer.clearLayers();
  if(!hasil)return;
  const pts=[...hasil.points]
    .filter(p=>p.cluster===clusterIdx)
    .sort((a,b)=>a.urutan-b.urutan);
  if(pts.length<1)return;
  const warna=COLORS[clusterIdx%COLORS.length];
  const latlngs=pts.map(p=>[p.lat,p.lon]);

  // Garis rute dengan panah arah
  L.polyline(latlngs,{color:warna,weight:3,opacity:.85,dashArray:"8,5"}).addTo(routeLayer);

  // Nomor urut di setiap titik
  pts.forEach((p,i)=>{
    const isFirst=i===0, isLast=i===pts.length-1;
    const icon=L.divIcon({
      className:"",
      html:`<div style="background:${warna};color:#fff;border-radius:50%;width:26px;height:26px;
            display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
            border:2px solid #fff;box-shadow:0 2px 6px #0004">
            ${isFirst?"▶":isLast?"⭐":p.urutan}</div>`,
      iconSize:[26,26],iconAnchor:[13,13]
    });
    L.marker([p.lat,p.lon],{icon})
      .bindPopup(`<b>#${p.urutan} ${p.id}</b><br>${p.jenis} · ${p.berat} kg<br>${p.pelestari}`)
      .addTo(routeLayer);
  });

  // Scroll ke peta supaya rute terlihat
  document.getElementById("map").scrollIntoView({behavior:"smooth",block:"center"});

  // Zoom peta ke rute ini
  map.fitBounds(L.latLngBounds(latlngs),{padding:[40,40]});

  // Tandai kartu aktif
  document.querySelectorAll(".pelestari-card").forEach(c=>{
    c.classList.toggle("aktif",+c.dataset.cluster===clusterIdx);
  });
  activeCluster=clusterIdx;
}

function hapusRute(){
  routeLayer.clearLayers();
  document.querySelectorAll(".pelestari-card").forEach(c=>c.classList.remove("aktif"));
  activeCluster=null;
  gambar();
}

function gambar(){
  layer.clearLayers();
  const src=hasil?hasil.points:points;
  src.forEach(p=>{
    const warna=hasil?COLORS[p.cluster%COLORS.length]:(p.sumber==="simulasi"?"#7b8d8a":"#c2410c");
    L.circleMarker([p.lat,p.lon],{radius:7,color:warna,fillColor:warna,fillOpacity:.75})
      .bindPopup(`${p.id}<br>${p.jenis}, ${p.berat} kg`+(hasil?`<br>${p.pelestari}, urutan ${p.urutan}`:"")).addTo(layer);
  });
  if(pilih)L.marker(pilih).addTo(layer);
  const sim=points.filter(p=>p.sumber==="simulasi").length;
  $("info").textContent=hasil?`${points.length} titik dikelompokkan menjadi ${hasil.k} cluster.`
    :`${points.length} titik: ${sim} data simulasi (abu-abu), ${points.length-sim} dari form (oranye).`;
}
function dashboard(){
  const per={};points.forEach(p=>per[p.jenis]=(per[p.jenis]||0)+p.berat);
  const total=points.reduce((s,p)=>s+p.berat,0);
  const poin=Math.round(points.reduce((s,p)=>s+p.berat*POIN[p.jenis],0));
  const kartu=[[total.toFixed(1)+" kg","Total sampah terkumpul"],[Object.entries(per).map(([j,b])=>`${j} ${b.toFixed(1)}`).join(", ")||"-","Rincian per jenis (kg)"],[poin,"🏅 Total poin reward pelestari"]];
  if(hasil)kartu.push([hasil.km_sebelum+" km","Jarak tempuh tanpa optimasi"],[hasil.km_sesudah+" km","Jarak tempuh setelah optimasi"],
    [`${hasil.km_hemat} km (${hasil.persen}%)`,"Jarak berhasil dihemat"],[hasil.emisi_hemat+" kg CO₂","Emisi karbon dihemat (asumsi 0,1 kg/km)"]);
  $("dash").innerHTML=kartu.map(([a,b])=>`<div class="stat"><b>${a}</b><span>${b}</span></div>`).join("");
}
function tugas(){
  if(!hasil)return;
  // Kelompokkan per pelestari
  const groups={};
  [...hasil.points].sort((a,b)=>a.cluster-b.cluster||a.urutan-b.urutan).forEach(p=>{
    if(!groups[p.pelestari])groups[p.pelestari]={cluster:p.cluster,pts:[]};
    groups[p.pelestari].pts.push(p);
  });
  const JENIS_ICON={plastik:"🧴",kertas:"📄",kaca:"🍶",logam:"🔩",elektronik:"📱"};
  const SUMBER_LABEL={simulasi:"📍 Titik awal",form:"✏️ Input manual"};
  let html=`<div class="tugas-legend">
    <span>📍 = data awal</span><span>✏️ = kamu input</span><span>🔄 = simulasi tambah</span>
    <span class="legend-sep">—</span><span>Kode titik jemput otomatis digenerate sistem</span>
  </div>`;
  Object.entries(groups).forEach(([nama,g])=>{
    const warna=COLORS[g.cluster%COLORS.length];
    const total=g.pts.reduce((s,p)=>s+p.berat,0).toFixed(1);
    const selesai=g.pts.filter(p=>p.selesai).length;
    const persen=Math.round(selesai/g.pts.length*100);
    html+=`<div class="pelestari-card" data-cluster="${g.cluster}">
      <div class="pelestari-header" style="border-left:4px solid ${warna}">
        <div class="pelestari-info">
          <span class="pelestari-nama" style="color:${warna}">${nama}</span>
          <span class="pelestari-meta">${g.pts.length} titik &bull; ${total} kg total</span>
        </div>
        <div class="pelestari-actions">
          <div class="pelestari-progress-wrap">
            <span class="pelestari-persen">${selesai}/${g.pts.length} selesai</span>
            <div class="pelestari-bar"><div class="pelestari-bar-fill" style="width:${persen}%;background:${warna}"></div></div>
          </div>
          <button class="btn-rute" data-cluster="${g.cluster}" style="border-color:${warna};color:${warna}">🗺 Lihat Rute</button>
        </div>
      </div>
      <div class="pelestari-rows">
        ${g.pts.map(p=>{
          const src=p.id.startsWith("U")?"✏️":p.id.startsWith("T")?"🔄":"📍";
          const coords=`${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;
          return `
        <div class="tugas-row ${p.selesai?"selesai":""}">
          <span class="urutan-badge" style="background:${warna}22;color:${warna}">${p.urutan}</span>
          <span class="tugas-id" title="Koordinat: ${coords}">${src} ${p.id}<br><small class="tugas-koordinat">${coords}</small></span>
          <span class="tugas-jenis">${JENIS_ICON[p.jenis]||""} ${p.jenis}</span>
          <span class="tugas-berat">${p.berat} kg</span>
          <button class="btn-status ${p.selesai?"btn-selesai":""}" data-id="${p.id}">${p.selesai?"✓ Selesai":"Jemput"}</button>
        </div>`;}).join("")}
      </div>
    </div>`;
  });
  $("tugas-wrap").innerHTML=html;
}
document.addEventListener("click",e=>{
  // Toggle status jemput — cari parent terdekat yang punya data-id
  const jemputBtn=e.target.closest("[data-id]");
  if(jemputBtn&&hasil){
    const p=hasil.points.find(x=>x.id===jemputBtn.dataset.id);
    if(p){p.selesai=!p.selesai;tugas();return;}
  }
  // Tombol lihat rute — cari parent terdekat .btn-rute
  const ruteBtn=e.target.closest(".btn-rute");
  if(ruteBtn){
    const ci=+ruteBtn.dataset.cluster;
    if(activeCluster===ci){hapusRute();}else{tampilRute(ci);}
    return;
  }
});
function render(){gambar();dashboard();tugas();}
map.on("click",e=>{pilih=[e.latlng.lat,e.latlng.lng];$("lokasi").value=pilih.map(v=>v.toFixed(5)).join(", ");gambar();});
$("form").addEventListener("submit",e=>{
  e.preventDefault();if(!pilih)return;
  points.push({id:"U"+String(++n).padStart(3,"0"),lat:pilih[0],lon:pilih[1],jenis:$("jenis").value,berat:+$("berat").value,sumber:"form"});
  pilih=null;$("lokasi").value="";hasil=null;render();
});
$("tambah").addEventListener("click",async()=>{
  const r=await fetch("/api/simulasi?n=20");points.push(...await r.json());hasil=null;render();
});
$("jalankan").addEventListener("click",async()=>{
  const r=await fetch("/api/cluster",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({points,k:+$("k").value})});
  const d=await r.json();
  if(!r.ok){$("pesan").textContent=d.error;return;}
  hasil=d;$("pesan").textContent=`Pembagian selesai: ${d.k} petugas, jarak turun ${d.persen}%.`;render();
});
fetch("/api/data").then(r=>r.json()).then(d=>{points=d;render();});
