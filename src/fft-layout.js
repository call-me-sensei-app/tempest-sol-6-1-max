export function bitReversedSpectrum(data, size, opposite = false) {
  const bits = Math.log2(size), result = new Float32Array(data.length);
  const reverse = value => { let out=0;for(let i=0;i<bits;i++){out=out*2+(value&1);value>>=1;}return out; };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let kx=reverse(x),ky=reverse(y);if(opposite){kx=(size-kx)%size;ky=(size-ky)%size;}
    const from=(ky*size+kx)*4,to=(y*size+x)*4;
    for(let c=0;c<4;c++)result[to+c]=data[from+c];
  }
  return result;
}
