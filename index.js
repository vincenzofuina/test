require('dotenv').config();

// Colors
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
let eInfo={};
let vInfo={};
let orderStatus = {};
let ContatoreTP=0;
let ContatoreSL=0;

const events = require('events');
const detectE = new events();
const API = require('kucoin-node-sdk');
const { loadeInfo,  placebuyorder, placesellorder } = require('./order');
const { log, error } = console;
const { money, baseSYM, thres, volValueEnv,SL_PERCENT,TP_PERCENT,TEST} = process.env;
const threshold = parseFloat(thres); // Soglia percentuale per il calo significativo
const { tickerTopics, klineTopics }  = require('./constants')
const walletValue= parseFloat(money);
const fs = require('fs');
const priceHistory = {};
let isMonitoringForOpportunity = {};
let isPositionOpen = {};


API.init(require('./config'));

/********************************************************************************************************* */
function initfile() {
  fs.readFile('orderStatus.json', 'utf8', function(err, data) {
      if (err) {
          console.error('Errore durante la lettura del file:', err);
          return;
      }
      try {
          orderStatus = JSON.parse(data);
          console.log(GREEN,`${new Date().toISOString()} - Stato degli ordini caricato:`, orderStatus);
          // Qui puoi fare operazioni aggiuntive con orderStatus
      } catch (parseError) {
          console.error('Errore durante il parsing dei dati:', parseError);
      }
  });
}
/********************************************************************************************************* */
function saveOrderStatus() {
  fs.writeFile('orderStatus.json', JSON.stringify(orderStatus, null, 2), 'utf8', function(err) {
      if (err) {
          console.error('Errore durante il salvataggio dello stato degli ordini:', err);
          return;
      }
      console.log(GREEN,`${new Date().toISOString()} - Stato degli ordini salvato con successo!`);
  });
}
/********************************************************************************************************* */
const startWS = async (client, API) => {
  try {
    log(BLUE,`${new Date().toISOString()} - Socket started!`,RESET);
    const callbackId = client.subscribe(tickerTopics.allSymbolsTicker, (message) => {
        processStream(message);
      });            
 } catch (err) {
    error(err);
    log(RED,`${new Date().toISOString()} - Socket has been restarted! for error:`, err,RESET);
      setTimeout(startWS, 30 * 1000); // Restart after 30 Sec only if active
  }
};
/***************************************************************************************************** 
                                                INIT
**************************************************************************************************** */
async function initBot(API) {
  try {
    initfile();
    console.log(BLUE,`${new Date().toISOString()} - In attesa dell'inizializzazione...`);
    result = await loadeInfo(API);
    [eInfo, vInfo] = result;
    console.log(BLUE,`${new Date().toISOString()} - Inizializzazione completata. BOT Starting...."`);
  } catch (err) {
    error(err);
    log(RED,`${new Date().toISOString()} - Socket has been restarted! for error:`, err,RESET);
      setTimeout(startWS, 30 * 1000); // Restart after 30 Sec only if active
  }
}

/***************************************************************************************************** */
// Funzione per cercare il parametro per calcoly BUY
/***************************************************************************************************** */
function findIncrements(symbol) {
  const foundSymbol = eInfo.data.find(symbolObj => symbolObj.symbol === symbol);
  return foundSymbol || null;
}
/***************************************************************************************************** */
/***************************************************************************************************** 
                                                MAIN
**************************************************************************************************** */
(async () => {
    log(YELLOW,`${new Date().toISOString()} - BOT KuCoin (UTC) is running...`,RESET);
    log(GREEN,`${new Date().toISOString()} - Wallet Walue is ${walletValue} ${baseSYM} PF: ${TP_PERCENT} SL: ${SL_PERCENT}`,RESET);
    log(GREEN,`${new Date().toISOString()} - When detected down of ${thres}% , the bot automatically trades the symbol.`,RESET);
    /* Connect the Socket */
    const client = new API.websocket.Datafeed();
    client.connectSocket();
    await initBot(API);
    await startWS(client, API);
})();

/********************************************************************************************************* */

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/********************************************************************************************************* */
const pauseMonitoringForSymbol = async (subject, duration) => {
  isPositionOpen[subject] = true;
  await sleep(duration); // Sospende il monitoraggio per 'duration' millisecondi
  isPositionOpen[subject] =false;
};

/********************************************************************************************************* */
const processStream = async (message) => {

  /* subject è il symbol subject: 'LTO-USDT' */
  let price=0;
  const { subject, data } = message;
  // Aggiungi una condizione per filtrare solo i simboli che contengono "USDT"
  if (!subject.includes("USDT")) {
    return; // Ignora il simbolo che non contiene "USDT"
  }
  if (!priceHistory[subject]) {
    initializeSubject(subject);
  }
  // const  buffer = Buffer.from(JSON.stringify(priceHistory));
  // const bufferLengthInKB = (buffer.length / 1024);
  // process.stdout.clearLine();
  // process.stdout.cursorTo(1);
  // process.stdout.write(RED + `${new Date().toISOString()} - HistoryBuffer Size: ${bufferLengthInKB.toFixed(2)} KB`);
  const currentPrice = parseFloat(data.price);
  // Controlla se l'ordine è stato piazzato per questo simbolo
  if (orderStatus[subject] && orderStatus[subject].isOrderPlaced) {
    if (currentPrice >= orderStatus[subject].takeProfitPrice)
    {
     // ContatoreTP++;
      //isAttemptingSell = true;
      orderStatus[subject].isOrderPlaced = false;    // Aggiorna lo stato dell'ordine 
      let qty= orderStatus[subject].qty;
      price = orderStatus[subject].takeProfitPrice;
      if(TEST == "false")
      {
        ContatoreTP = await placesellorder({ API, qty, subject, price, orderStatus, contatore: ContatoreTP});
      }
      console.log(RED,`${new Date().toISOString()} - ORDINE VENDITA TP: ${subject} ${orderStatus[subject].takeProfitPrice} ${currentPrice} ${ContatoreTP}`);
     
      saveOrderStatus();
    } 
    if( currentPrice <= orderStatus[subject].stopLossPrice) {
      // Piazza un ordine di vendita
      //ContatoreSL++;
      //isAttemptingSell = true;
      orderStatus[subject].isOrderPlaced = false;
      let qty= orderStatus[subject].qty;
      price = orderStatus[subject].stopLossPrice;
      if(TEST == "false")
      {
        ContatoreSL = await placesellorder({ API, qty, subject, price, orderStatus, contatore: ContatoreSL });
      }
      console.log(RED,`${new Date().toISOString()} - ORDINE VENDITA SL: ${subject} ${orderStatus[subject].stopLossPrice} ${currentPrice} ${ContatoreSL}`) 
      saveOrderStatus();
    }
  }
  updatePriceHistory(subject, currentPrice, data.time);
  if (!isMonitoringForOpportunity[subject] && !(orderStatus[subject] && orderStatus[subject].isOrderPlaced) && checkPriceDrop(subject, currentPrice)) {
    isMonitoringForOpportunity[subject] = true;
  }
  //  if ((orderStatus[subject] && orderStatus[subject].isAttemptingSell)) {
  //    console.log(RED,`${new Date().toISOString()} - Attualmente impegnato in tentativi di vendita`);
  //  }

  if (isMonitoringForOpportunity[subject] && !(orderStatus[subject] && orderStatus[subject].isOrderPlaced) && !(orderStatus[subject] && orderStatus[subject].isAttemptingSell)) {
      // Verifica se sono passati almeno 5 minuti dall'ultimo ordine
      const currentTime = new Date().getTime();
      if ((orderStatus[subject] && orderStatus[subject].isOrderPlaced) != null) {
      const timeSinceLastOrder = currentTime - orderStatus[subject].timeStamp;
     // log(timeSinceLastOrder);
      if (timeSinceLastOrder < 240000) { // 240000 millisecondi equivalgono a 4 minuti
     // console.log("Meno di 5 minuti dall'ultimo ordine, non piazzare un nuovo ordine",subject);
      return;
      }
   
    }
    if ((orderStatus[subject] && orderStatus[subject].isTimeLocked) != null) {
      orderStatus[subject].isTimeLocked=false;
      saveOrderStatus();
    }
      isMonitoringForOpportunity[subject] = false;
      detectE.emit('ORDER', currentPrice, subject);
  }
};
/********************************************************************************************************* */
function initializeSubject(subject) {
  priceHistory[subject] = [];
  isMonitoringForOpportunity[subject] = false;
  isPositionOpen[subject] = false;
}
/********************************************************************************************************* */
function updatePriceHistory(subject, currentPrice, currentTime) {
  priceHistory[subject].push({ price: currentPrice, time: currentTime });
   // Definisci il limite di tempo per mantenere i dati (5 minuti in questo caso)
   const timeLimit = 3 * 60 * 1000; // 5 minuti in millisecondi

   // Mentre il dato più vecchio è più vecchio di 5 minuti rispetto all'ultimo timestamp, rimuovilo
   while (priceHistory[subject].length > 0 && currentTime - priceHistory[subject][0].time > timeLimit) {
       priceHistory[subject].shift(); // Rimuove il primo elemento dell'array
   }
}
/********************************************************************************************************* */
function checkPriceDrop(subject, currentPrice) {
  const history = priceHistory[subject];
  let dropDetected = false;

  for (const entry of history) {
    const priceChange = ((currentPrice - entry.price) / entry.price) * 100;

      if (priceChange <= -threshold) {
        
        const volValue = findVolValueBySymbol(vInfo, subject);
        if (volValue < parseFloat(volValueEnv)) {
        //  console.log(RED, `${new Date().toISOString()} - Volumi troppo bassi per ${subject}: ${volValue}`, RESET);
          continue; // Continua il ciclo senza impostare dropDetected
        }
        console.log(YELLOW, `${new Date().toISOString()} - Discesa rilevata di : ${priceChange.toFixed(2)}% ${subject} a ${currentPrice} Vol:${volValue}`);
        console.log(RED,`${new Date().toISOString()} - Stato tentativo di vendita flag: ${(orderStatus[subject] && orderStatus[subject].isAttemptingSell)}`);
        dropDetected = true;
        break; // Interrompe il ciclo se viene rilevata una discesa sufficiente
      }
  }
  return dropDetected;
}
/********************************************************************************************************* */
function findVolValueBySymbol(payload, symbol) {
  if (!payload || typeof payload !== 'object') {
      console.error("Payload is not an object");
      return null;
  }
  // Adjusting to access the ticker array inside the 'data' object
  if (!payload.data || !Array.isArray(payload.data.ticker)) {
      console.error("Payload does not have a 'data' object with a ticker array");
      return null;
  }
  const tickerItem = payload.data.ticker.find(item => item.symbol === symbol);
  return tickerItem ? tickerItem.volValue : null;
}
/********************************************************************************************************* */
detectE.on('ORDER', async (price, symbol) => {
  try {
    //stopWS();  
    const marketSpec = findIncrements(symbol); 

    const priceTick=(price+(marketSpec.priceIncrement*3)).toFixed(Math.abs(Math.log10(parseFloat(marketSpec.priceIncrement))));
    let qty =   (walletValue / priceTick).toFixed(Math.abs(Math.log10(parseFloat(marketSpec.baseMinSize))));
   

    //let qty =   (walletValue / price).toFixed(Math.abs(Math.log10(parseFloat(marketSpec.baseMinSize))));
    if( qty < parseFloat(marketSpec.baseMinSize))
    {
      console.log(RED,`${new Date().toISOString()} - Quantità non ammessa ${qty} da market ${marketSpec.baseMinSize}`);
    }
    else
    {
      let sellpriceTP= (priceTick*(1 + parseFloat(TP_PERCENT))).toFixed(Math.abs(Math.log10(parseFloat(marketSpec.priceIncrement))));
      let sellpriceSL= (priceTick*(1 - parseFloat(SL_PERCENT))).toFixed(Math.abs(Math.log10(parseFloat(marketSpec.priceIncrement))));
      
      //let sellpriceTP= (price*(1 + parseFloat(TP_PERCENT))).toFixed(Math.abs(Math.log10(parseFloat(marketSpec.priceIncrement))));
      //let sellpriceSL= (price*(1 - parseFloat(SL_PERCENT))).toFixed(Math.abs(Math.log10(parseFloat(marketSpec.priceIncrement))));
      const currentTime = new Date().getTime();
      /* BUY */
      orderStatus[symbol] = {
        purchasePrice: priceTick,
        takeProfitPrice: sellpriceTP,
        stopLossPrice: sellpriceSL,
        qty: qty,
        isOrderPlaced: true,
        isTimeLocked: true,
        isAttemptingSell: false,
        timeStamp: currentTime
      };
      /* BUY CMD */
      //orderStatus[symbol].isOrderPlaced=false;
      if(TEST == "false")
      {
        const bresp = await placebuyorder({ API, qty, symbol, priceTick});
      }
      saveOrderStatus();
      console.log(GREEN,`${new Date().toISOString()} - Piazzando ordine di acquisto per ${symbol} a ${price} pt:${priceTick} Qty:${qty} TP:${sellpriceTP} SL:${sellpriceSL} OR:${orderStatus[symbol].isOrderPlaced}`);
    }
    } catch (err) {
    console.log(RED,`${new Date().toISOString()} - Main Cycle ${err}`,RESET);
    process.exit(0);
  }
});