import {type Claim,serial} from './types';
// Canvas avoids Safari's SVG foreignObject restrictions. Font faces are self-hosted.
export async function exportCertificate(claim:Claim,story:boolean,text:string,url:string){
 await document.fonts.ready;await Promise.all([document.fonts.load('900 100px Archivo'),document.fonts.load('400 30px Instrument'),document.fonts.load('400 20px Plex')]);
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=story?1920:1350;const c=canvas.getContext('2d')!;const h=canvas.height;
 c.fillStyle='#F1ECE2';c.fillRect(0,0,1080,h);c.strokeStyle='#1A1A17';c.fillStyle='#1A1A17';c.lineWidth=2;c.strokeRect(36,36,1008,h-72);c.strokeRect(47,47,986,h-94);
 const mono=(s:string,x:number,y:number,size=19)=>{c.font=`400 ${size}px Plex`;c.fillText(s,x,y)};const line=(y:number)=>{c.beginPath();c.moveTo(80,y);c.lineTo(1000,y);c.stroke()};
 for(const x of [36,1044])for(const y of [36,h-36]){c.beginPath();c.moveTo(x-13,y);c.lineTo(x+13,y);c.moveTo(x,y-13);c.lineTo(x,y+13);c.stroke()}
 mono('DIBS / REGISTRY OF CLAIMS',80,105);mono('FORM D-1',890,105);line(135);mono('CERTIFICATE OF DIBS',80,200,22);mono('No. '+serial(claim.claim_no),80,237,22);
 c.font='900 85px Archivo';c.fillText('D.',870,237);const top=story?420:340;c.font='400 34px Instrument';c.fillText('Let the record show.',80,top);c.fillText('I called dibs on',80,top+48);
 const words=claim.display.toUpperCase().split(' ');let size=145;let lines:string[]=[];
 do {c.font=`900 ${size}px Archivo`;lines=[];let row='';for(const word of words){const candidate=row?row+' '+word:word;if(c.measureText(candidate).width>910&&row){lines.push(row);row=word}else row=candidate}if(row)lines.push(row);if(lines.length<=3&&lines.every(s=>c.measureText(s).width<=910))break;size-=5;}while(size>=35);
 let y=top+110;for(const row of lines){y+=size*.9;c.fillText(row,80,y)};y+=45;line(y);mono(claim.category_name.toUpperCase(),80,y+38,20);mono(claim.category_date,820,y+38,20);line(y+65);
 const holder=Math.max(y+120,story?1100:850);mono('HELD BY',80,holder,19);c.font='600 42px Instrument';c.fillText(claim.handle,80,holder+60);c.font='400 26px Instrument';c.fillText(claim.school==='None'?'Independent claimant':claim.school,80,holder+104);
 mono('OBSCURITY',80,h-250);for(let i=0;i<5;i++){c.beginPath();c.arc(93+i*42,h-211,12,0,Math.PI*2);if(claim.obscurity&&i<claim.obscurity)c.fill();else c.stroke()};mono(claim.obscurity?'Wikipedia pageviews':'Unrated: pageviews unavailable',80,h-165,16);
 c.save();c.translate(795,h-247);c.rotate(((claim.claim_no*7.31%7)-4)*Math.PI/180);c.strokeStyle='#E1462B';c.fillStyle='#E1462B';c.lineWidth=5;c.strokeRect(-166,-67,332,147);c.strokeRect(-156,-57,312,127);c.font='900 110px Archivo';c.textAlign='center';c.fillText('DIBS',0,32);c.fillStyle='#1A1A17';c.font='400 14px Plex';c.fillText(claim.obscurity&&claim.obscurity>=4?'DEEP CUT · REGISTERED':'OFFICIALLY REGISTERED',0,61);c.restore();
 c.setLineDash([6,6]);line(h-120);c.setLineDash([]);mono(`ONE OF ${claim.total_registrable.toLocaleString()}. ONLY ONE YOURS.`,80,h-80,17);mono(location.host,740,h-80,17);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG failed')),'image/png'));const file=new File([blob],`dibs-${claim.display.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${story?'story':'feed'}.png`,{type:'image/png'});
 if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Certificate of Dibs',text,url});return 'A certified copy has left the office.'}catch(e){if((e as Error).name==='AbortError')return 'Copy retained at the office.'}}
 const object=URL.createObjectURL(blob);const a=document.createElement('a');a.href=object;a.download=file.name;a.textContent='Open your certificate image';a.target='_blank';a.rel='noopener';
 if(/Instagram|FBAN|FBAV|TikTok|Bytedance/i.test(navigator.userAgent)){const opened=window.open(object,'_blank');if(!opened){document.querySelector('.share-area')?.append(a)}return 'Open the image, then press and hold to save. Copy text supplies the caption.'}
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(object),120000);return 'PNG downloaded. If your browser blocked the file, open this page in Safari or Chrome. Copy text supplies the caption.';
}
