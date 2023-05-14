const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf("6212591235:AAHM9Zq2gsq-xVVrFFVnNBf3IU25bCL0CxU");
const fetch = require("node-fetch");
const http = require('http');
let lastCoins = [];

bot.start((ctx) => {
    const keyboard = Markup.keyboard([
        ["BTC", "ETH", "LTC", "MATIC"],
        ["TRX", "FTM", "LINK", "AVAX"],
        ["XRP", "ZEC"],
    ]);

    ctx.reply("Select a crypto currency:", keyboard);
});
bot.hears(['BTC', 'ETH', 'LTC', 'XRP', 'MATIC', 'TRX', 'FTM', 'LINK', 'AVAX', 'ZEC'], async (ctx) => {
    const coin = ctx.message.text;
    const message = await ctx.reply(`Loading prices for ${coin}...`);
    getCoins(coin, message, ctx);
});

async function getCoins(coin, message, ctx) {
    try {
        const prices = await getPrices(coin);
        const newMessage = generateMessage(prices, coin);
        await ctx.telegram.editMessageText(
            message.chat.id,
            message.message_id,
            null,
            newMessage
        );
        const lastCoin = {
            coin,
            message,
            text: newMessage,
            intervalId: null
        };
        updateCoins(lastCoin);
        startCoinUpdate(lastCoin, ctx);
        scheduleCoinRemoval(lastCoin);
    } catch (err) {
        console.error(err);
    }
}


function updateCoins(coin) {
    lastCoins = lastCoins.filter(lastCoin => lastCoin.coin !== coin.coin);
    lastCoins.push(coin);
    if (lastCoins.length > 2) {
        const { message: oldMessage } = lastCoins.shift();
        clearInterval(oldMessage.intervalId);
    }
}

async function startCoinUpdate(coin, ctx) {
    const intervalId = setInterval(async () => {
        try {
            const prices = await getPrices(coin.coin);
            const newMessage = generateMessage(prices, coin.coin);
            const lastCoin = lastCoins.find(lastCoin => lastCoin.coin === coin.coin);
            if (lastCoin && lastCoin.text !== newMessage) {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    lastCoin.message.message_id,
                    null,
                    newMessage
                );
                lastCoin.text = newMessage;
            }
        } catch (err) {
            console.error(err);
        }
    }, 5000);
    coin.intervalId = intervalId;
}

function scheduleCoinRemoval(coin) {
    setTimeout(() => {
        clearInterval(coin.intervalId);
        lastCoins = lastCoins.filter(lastCoin => lastCoin.coin !== coin.coin);
    }, 70000);
}

function generateMessage(prices, coin) {
    const priceValues = prices.map(({ price }) => price);
    const maxPrice = Math.max(...priceValues);
    const minPrice = Math.min(...priceValues);
    const spread = Math.floor(((maxPrice - minPrice) / minPrice) * 10000) / 100;

    prices.sort((a, b) => b.price - a.price);

    const newMessage =
        `${coin}USDT\n` +
        "===================\n\n" +
        prices
            .map(
                ({ exchange, price }, index) => `${index + 1}. ${exchange}:  $${price}`
            )
            .join("\n\n") +
        "\n\n===================\n" +
        `Spread: ${spread}%`;

    return newMessage;
}

async function getPrices(coin) {
    const binanceUSPrice = await getBinanceUsBtcPrice(coin);
    const bybitPrice = await getBybitBtcPrice(coin);
    const kuCoinPrice = await getKucoinBtcPrice(coin);

    return [
        { exchange: "KuCoin", price: kuCoinPrice },
        { exchange: "Binance US", price: binanceUSPrice },
        { exchange: "Bybit", price: bybitPrice },
    ];
}

async function getBinanceBtcPrice(coin) {
    try {
        const response = await fetch(
            `https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`
        );
        const data = await response.json();
        return +data.price;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to get Binance BTC price");
    }
}

async function getBinanceUsBtcPrice(coin) {
    try {
        const response = await fetch(
            `https://api.binance.us/api/v3/ticker/price?symbol=${coin}USDT`
        );
        if (!response.ok) {
            throw new Error(`Request failed with status code ${response.status}`);
        }
        const data = await response.json();
        return parseFloat(data.price);
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getBybitBtcPrice(coin) {
    try {
        const response = await fetch(
            `https://api.bybit.com/v2/public/tickers?symbol=${coin}USDT`
        );
        const data = await response.json();
        if (data.ret_code === 0) {
            return +data.result[0].last_price;
        } else {
            throw new Error(
                `Error retrieving price for ${coin}. Error code: ${data.ret_code}`
            );
        }
    } catch (error) {
        console.error(
            `Error getting price for ${coin} from Bybit: ${error.message}`
        );
        return null;
    }
}

async function getKucoinBtcPrice(coin) {
    try {
        const response = await fetch(
            `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${coin}-USDT`
        );
        const data = await response.json();
        if (data && data.data && data.data.price) {
            return +data.data.price;
        } else {
            throw new Error("Price not found in API response");
        }
    } catch (error) {
        console.error(`Error fetching price from Kucoin API: ${error.message}`);
        throw error;
    }
}

bot.command("restart", (ctx) => {
    ctx.reply("Bot is restarting...");
    bot.stop(false);
    // здесь можно добавить код, который закроет все соединения, выйдет из всех сеансов и перезапустит бота
});

bot.catch((err) => {
    console.log("Error: аф", err);
});

bot.command('reset', (ctx) => {
    resetPrices(lastCoins);
    ctx.reply('All prices updates have been reset.');
});

function resetPrices(lastCoins) {
    for (const coin of lastCoins) {
        clearInterval(coin.message.intervalId);
    }
    lastCoins.length = 0; // очищаем массив
}

bot.launch();
