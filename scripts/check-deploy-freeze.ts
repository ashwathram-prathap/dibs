const now=Date.now();
if(process.argv.includes('--production')&&now>=Date.parse('2026-11-23T18:00:00-05:00')&&now<Date.parse('2026-11-24T00:00:00-05:00'))throw Error('Launch freeze: no production deploys between Nov 23 6 PM and Nov 24 midnight ET.');
