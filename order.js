// Colors
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const crypto = require('crypto');
const { log, error } = console;
const NP = require('number-precision');
NP.enableBoundaryChecking(false);
const maxRetries = 5;

/********************************************************************************************************* */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/********************************************************************************************************* */
/*****************************************************************************************************/
// Funzione per generare una stringa casuale di 128 bit
/*****************************************************************************************************/
function generateRandomString() {
  // 128 bit sono equivalenti a 16 byte
  const size = 16; 
  return crypto.randomBytes(size).toString('hex');
}
/********************************************************************************************************* */
const loadeInfo = async (API) => {
  const maxRetries = 10; // Maximum number of retries
  const retryDelay = 1; // Delay between retries in milliseconds (1 ms)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {

      /* Info Mercato  */
      const eInfo_loc = await API.rest.Market.Symbols.getSymbolsList('USDT');
      const vInfo_loc= await API.rest.Market.Symbols.getAllTickers();
      //console.log(eInfo);
      //console.log(vInfo);
      return [eInfo_loc,vInfo_loc];
      
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`${new Date().toISOString()} - Maximum retries reached. Error:`, err);
        throw err; // Rethrow the last caught error
      }
        console.error(`${new Date().toISOString()} - Attempt ${attempt} failed. Retrying in ${retryDelay}ms...`, err);
        await new Promise
    }
  }
};
/********************************************************************************************************* */
const buy = async ({ API, symbol, qty, price, UUIDbuy }) => {
  try {
    return await API.rest.Trade.Orders.postOrder({
      clientOid:UUIDbuy,
      symbol:symbol,
      side:'buy',
      size:String(qty),
      type:'limit',
      price:String(price),
      timeInForce:'GTT',
      cancelAfter:'10'
    });
    //console.log(GREEN,`${new Date().toISOString()}placeHfOrderResult`,result);
       
  } catch (err) {
            console.log(RED,`${new Date().toISOString()} - BUY ${err}`,RESET);
            process.exit(0);
  };
};
/********************************************************************************************************* */
const sell = async ({ API, subject, qty, price, UUIDsell}) => {
  try {
    return await API.rest.Trade.Orders.postOrder({
      clientOid:UUIDsell,
      symbol:subject,
      side:'sell',
      size:String(qty),
      type:'limit',
      price:String(price),
      timeInForce:'GTC',
    });       
  } catch (err) {
        console.log(RED,`${new Date().toISOString()} - SELL ${err}`,RESET);
        process.exit(0);
  };
};
/********************************************************************************************************* */
const placebuyorder = async({ API, symbol, qty, price}) => {

     let bresp;
     const retryErrorCodes = ['400350', '429000']; // Lista dei codici di errore per il retry
     const UUIDbuy = generateRandomString();
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
           bresp = await buy({ API, qty , symbol, price,UUIDbuy });
           console.log(GREEN, `${new Date().toISOString()} - BUY attempt ${attempt}`, bresp);
           // Controlla se la risposta contiene uno dei codici di errore per il retry
           if (bresp && retryErrorCodes.includes(bresp.code)) {
               console.log(RED, `${new Date().toISOString()} - Buy attempt ${attempt} failed with error code ${bresp.code}. Retrying...`, RESET);
               continue; // Continua il ciclo per un nuovo tentativo
           }
           break; // Esce dal ciclo se non c'è l'errore specifico
       } catch (buyError) {
          // console.log(RED, `${new Date().toISOString()} - Buy attempt ${attempt} encountered an error: ${buyError}`, RESET);
           if (attempt === maxRetries) {
               throw buyError; // Rilancia l'errore dopo l'ultimo tentativo
           }
       }
     }
      // Controlla se bresp è valido prima di procedere
   if (!bresp || retryErrorCodes.includes(bresp.code)) {
     throw new Error(`Buy operation failed after maximum attempts due to error code ${bresp.code}`);
   }
   

}
/********************************************************************************************************* */
const placesellorder = async({ API, qty, subject, price, orderStatus, contatore}) => {
   
   const UUIDsell = generateRandomString();
   let sresp;
   const retryDelay = 1000; // Ritardo tra i tentativi in millisecondi (1000 ms = 1 secondo)
   const retryErrorCodessell = ['200004']; // Lista dei codici di errore per il retry
   orderStatus[subject].isAttemptingSell = true;
  
   for (let attempt = 1; attempt <= (maxRetries*2); attempt++) {
     try {

       // log(subject,qty , price, UUIDsell);
        sresp = await sell({API, subject, qty, price, UUIDsell});
      
        console.log(MAGENTA, `${new Date().toISOString()} - Sell attempt ${attempt}`, sresp);
        // Controlla se la risposta contiene uno dei codici di errore per il retry
        if (sresp && retryErrorCodessell.includes(sresp.code)) {
             // console.log(MAGENTA, `${new Date().toISOString()} - Sell attempt ${attempt} failed with error code ${sresp.code}. Retrying...${isAttemptingSell}`, RESET,);
             await sleep(retryDelay); // Attendi 1 secondo prima di riprovare
             continue; // Continua il ciclo per un nuovo tentativo
         }
        // isAttemptingSell = false;
        contatore++;
         break; // Esce dal ciclo se non c'è l'errore specifico
     } catch (sellError) {
        // console.log(RED, `${new Date().toISOString()} - Sell attempt ${attempt} encountered an error: ${sellError}`, RESET);
         if (attempt < maxRetries) {
          await sleep(retryDelay); // Attendi 1 secondo prima di riprovare
        } else {
          throw sellError; // Rilancia l'errore dopo l'ultimo tentativo
        }
     }
  }
  //  //Controlla se sresp è valido prima di procedere
  // if (!sresp || retryErrorCodessell.includes(sresp.code)) {
  //  throw new Error(`Buy operation failed after maximum attempts due to error code ${sresp.code}`);
 // }
  orderStatus[subject].isAttemptingSell = false; 
  return contatore;
}
/********************************************************************************************************* */
const getorderstatus = async (API) => {
  try {
    const response=  await API.rest.Trade.Orders.getOrdersList('TRADE', {status: 'active', symbol: 'KMA-USDT'},);
// //log(response);
//         // Stampa ogni oggetto nell'array items
//         response.data.items.forEach((item, index) => {
//         console.log(`Item ${index + 1}:`, item);
// });
// Filtra e stampa solo gli oggetti con symbol = 'ORCA-USDT'
// const orcaUsdtItems = response.data.items.filter(item => item.symbol === 'ORCA-USDT');
// orcaUsdtItems.forEach((item, index) => {
//   console.log(`ORCA-USDT Item ${index + 1}:`, item);
// });
   
    return response;     
  } catch (err) {
        console.log(RED,`${new Date().toISOString()} - SELL ${err}`,RESET);
        process.exit(0);
  };
};

module.exports = {loadeInfo, placebuyorder, placesellorder};