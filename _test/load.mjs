const mods = ['api','config','crisis','memory','persona']
for (const m of mods) {
  try { await import('../js/' + m + '.js'); console.log('OK   ' + m + '.js') }
  catch (e) { console.log('FAIL ' + m + '.js -> ' + e.message) }
}
