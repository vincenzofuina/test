
// Colors
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
require('dotenv').config();
const { money, baseSYM, exchangeSYM, profit, launchTime} = process.env;
//check new coin listsings
const { log, error } = console;
const events = require('events');
const detectE = new events();
const { tickerTopics }  = require('./constants')

/***************************************************************************************************** */
// Funzione per processare i messaggi in arrivo
// Ad esempio: websocket.on('message', processData);
/***************************************************************************************************** */
const threshold = 1; // Soglia percentuale per il calo significativo
const priceHistory = {};
let isMonitoringForOpportunity = {};
let isPositionOpen = {};
let lowestPriceAfterDrop = {};
let lastTwoPrices = {};
let hasOperationBeenExecuted = {};
let eInfo = {};
const processStream = (message,API) => {
  const { subject, data } = message;

  // Aggiungi una condizione per filtrare solo i simboli che contengono "USDT"
  if (!subject.includes("USDT")) {
    return; // Ignora il simbolo che non contiene "USDT"
  }

  if (!priceHistory[subject]) {
    initializeSubject(subject);
  }

  const currentPrice = parseFloat(data.price);
  updatePriceHistory(subject, currentPrice, data.time);

  if (!isMonitoringForOpportunity[subject] && !isPositionOpen[subject] && checkPriceDrop(subject, currentPrice)) {
    isMonitoringForOpportunity[subject] = true;
    lowestPriceAfterDrop[subject] = currentPrice;
  }

  if (isMonitoringForOpportunity[subject] && !isPositionOpen[subject]) {
    updateLastTwoPrices(subject, currentPrice);
    //if (shouldBuy(subject)) {
      placeBuyOrder(subject, currentPrice, API);
      isMonitoringForOpportunity[subject] = false;
      isPositionOpen[subject] = true;
      hasOperationBeenExecuted[subject] = true;
    //}
  }

  // Qui aggiungi la logica per verificare se è il momento di vendere
  // Se vendi, imposta isPositionOpen[subject] su false e hasOperationBeenExecuted[subject] su false
};

function initializeSubject(subject) {
  priceHistory[subject] = [];
  isMonitoringForOpportunity[subject] = false;
  isPositionOpen[subject] = false;
  lowestPriceAfterDrop[subject] = null;
  lastTwoPrices[subject] = [];
  hasOperationBeenExecuted[subject] = false;
}

function updatePriceHistory(subject, currentPrice, currentTime) {
  priceHistory[subject].push({ price: currentPrice, time: currentTime });
}

function checkPriceDrop(subject, currentPrice) {
  const history = priceHistory[subject];
  if (history.length < 2) return false;

  const priceFiveMinutesAgo = history[0].price;
  const priceChange = ((currentPrice - priceFiveMinutesAgo) / priceFiveMinutesAgo) * 100;
  if (priceChange <= -threshold) {
    console.log(`${new Date().toISOString()} - Discesa rilevata di : ${priceChange.toFixed(2)}% ${subject} a ${currentPrice}`);
  }
  return priceChange <= -threshold;
}

function updateLastTwoPrices(subject, currentPrice) {
  if (lastTwoPrices[subject].length >= 2) {
    lastTwoPrices[subject].shift();
  }
  lastTwoPrices[subject].push(currentPrice);
}

function shouldBuy(subject) {
  if (lastTwoPrices[subject].length < 2) {
    return false;
  }
  return lastTwoPrices[subject][0] >= lowestPriceAfterDrop[subject] && lastTwoPrices[subject][1] >= lastTwoPrices[subject][0];
}

async function placeBuyOrder  (subject, price, API) {
  const sellprice= (price*profit).toFixed(8);
  try{
    const resp = await loadeInfo(subject,API);
  }
  catch (err) {
    console.log(err);
  }
  
  console.log(`${new Date().toISOString()} - Piazzando ordine di acquisto per ${subject} a ${price} sell:${sellprice}`);
  // Altre logiche di gestione dell'ordine di acquisto
}


/********************************************************************************************************* */

const loadeInfo = async (API, subject) => {
  const maxRetries = 10; // Maximum number of retries
  const retryDelay = 1; // Delay between retries in milliseconds (1 ms)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const payload = await API.rest.Symbols.getSymbolsList({ market: subject });
      // Assuming 'payload' is the object you provided
      if (payload && Array.isArray(payload.subject)) {
            payload.symbols.forEach(symbolInfo => {
              eInfo[symbolInfo.symbol] = symbolInfo;
              console.log( eInfo[subject]['filters']);
            });
          } else {
                  console.error(`${new Date().toISOString()} - Payload is invalid or the symbols array is missing`);
            }

      // Check if the response contains an empty array and retry if so
      if (!eInfo ) {
        if (attempt < maxRetries) {
          console.log(`${new Date().toISOString()} - Attempt ${attempt} failed. Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        } else {
          throw new Error(`${new Date().toISOString()} - Response contains an empty array after maximum retries`);
        }
      }

      // If response is valid and not empty, process further
      // Assuming you want to do something with the response here
      // ...

      return; // Return the valid response
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

// Aggiungi una funzione per gestire la vendita
function placeSellOrder(subject, price) {
  console.log(`${new Date().toISOString()} - Piazzando ordine di vendita per ${subject} a ${price}`);
  isPositionOpen[subject] = false;
  hasOperationBeenExecuted[subject] = false;
}



// const threshold = 5; // Soglia percentuale per il calo significativo
// const priceHistory = {};
// let isWatchingForBuyOpportunity = false;
// let lowestPriceAfterDrop = null;
// let lastTwoPrices = []; // Memorizza gli ultimi due prezzi per ogni subject

// const processStream = (message) => {
//   const { subject, data } = message;
//   if (!priceHistory[subject]) {
//     priceHistory[subject] = [];
//     lastTwoPrices[subject] = [];
//   }

//   const currentPrice = parseFloat(data.price);
//   priceHistory[subject].push({ price: currentPrice, time: data.time });

//   // Rimuovi i dati più vecchi di 5 minuti
//   const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
//   priceHistory[subject] = priceHistory[subject].filter(entry => entry.time > fiveMinutesAgo);

//   checkPriceDrop(subject, currentPrice);
  
//   if (isWatchingForBuyOpportunity) {
//     updateLastTwoPrices(subject, currentPrice);
//     if (shouldBuy(subject)) {
//       placeBuyOrder(subject, currentPrice);
//       isWatchingForBuyOpportunity = false;
//     }
//   }
// };

// function checkPriceDrop(subject, currentPrice) {
//   const history = priceHistory[subject];
//   if (history.length < 2) return;

//   const priceFiveMinutesAgo = history[0].price;
//   const priceChange = ((currentPrice - priceFiveMinutesAgo) / priceFiveMinutesAgo) * 100;

//   if (priceChange <= -threshold) {
//     console.log(`${new Date().toISOString()} Calo significativo del prezzo per ${subject}: ${priceChange.toFixed(2)}%`);
//     isWatchingForBuyOpportunity = true;
//     lowestPriceAfterDrop = currentPrice;
//     lastTwoPrices[subject] = []; // Resetta l'array degli ultimi due prezzi
//   }
// }

// function updateLastTwoPrices(subject, currentPrice) {
//   if (lastTwoPrices[subject].length >= 2) {
//     lastTwoPrices[subject].shift(); // Rimuove il prezzo più vecchio se ci sono già due prezzi
//   }
//   lastTwoPrices[subject].push(currentPrice);
// }

// function shouldBuy(subject) {
//   if (lastTwoPrices[subject].length < 2) {
//     return false; // Non abbiamo ancora due prezzi per confrontare
//   }
//   return lastTwoPrices[subject][0] >= lowestPriceAfterDrop && lastTwoPrices[subject][1] >= lastTwoPrices[subject][0];
// }

// function placeBuyOrder(subject, price) {
//   console.log(GREEN,`${new Date().toISOString()} - Piazzando ordine di acquisto per ${subject} a ${price}`);
// }

/***************************************************************************************************** */


/***************************************************************************************************** */
const refreshSymbols = async (client) => {
  const maxRetries = 10; // Maximum number of retries
  const retryDelay = 10; // Delay between retries in milliseconds 

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${new Date().toISOString()} - exchangeInfo attemp #`,attempt);
      const response = await client.exchangeInfo();
      // Check if response is valid and not empty
      if (response && response.symbols && response.symbols.length > 0) {
        response.symbols.forEach(({ symbol, status }) => {
          if (status === 'TRADING') {
            symbols[symbol] = 1;
          }
        });
        return; // Successful execution, exit the function
      } else {
        throw new Error(RED,`${new Date().toISOString()} - Empty or invalid response`,RESET);
      }
    } catch (err) {
      console.error(RED,`${new Date().toISOString()} - Attempt ${attempt}: Si è verificato un errore durante l'aggiornamento dei simboli`, err,RESET);
      // If the maximum number of retries has been reached, rethrow the error
      if (attempt === maxRetries) {
        throw err;
      }
      // Wait for the specified delay before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
};
/***************************************************************************************************** */


/***************************************************************************************************** */
let isWebSocketActive = true;
const startWS = async (client, API) => {
  try {
    log(BLUE,`${new Date().toISOString()} - Socket has been restarted!`,RESET);
    //await refreshSymbols(client);

   // tickerTopics.allSymbolsTicker=tickerTopics.symbolTicker+symbol;
    const callbackId = client.subscribe(tickerTopics.allSymbolsTicker, (message) => {
     // if (message.topic === tickerTopics.symbolTicker) {
      if (!isWebSocketActive) return;
        processStream(message,API);
      });
 } catch (err) {
    error(err);
    log(RED,`${new Date().toISOString()} - Socket has been restarted! for error:`, err,RESET);
    if (isWebSocketActive) {
      setTimeout(startWS, 30 * 1000); // Restart after 30 Sec only if active
    }
  }
};
// Funzione per fermare il WebSocket
const stopWS = () => {
  isWebSocketActive = false;
  // Qui puoi anche aggiungere ulteriori pulizie o chiusure necessarie
};

module.exports = { detectE, startWS, stopWS };  
