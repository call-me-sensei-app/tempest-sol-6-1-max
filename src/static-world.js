export function freezeStaticWorld(root, excluded = []) {
  root.updateMatrixWorld(true);
  const skip = new Set(excluded); let frozen = 0;
  root.traverse(object => {
    if (object.name === 'candle flame') return;
    for(let ancestor=object;ancestor&&ancestor!==root;ancestor=ancestor.parent)if(skip.has(ancestor))return;
    // Root and nonmoving groups have fixed transforms, but their animated
    // descendants still update normally. Never use this for the moving ship.
    object.updateMatrix();object.matrixAutoUpdate=false;
    object.matrixWorldAutoUpdate=false;object.matrixWorldNeedsUpdate=false;frozen++;
  });
  return frozen;
}
