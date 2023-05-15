const {Telegraf, Markup} = require("telegraf");

const bot = new Telegraf("6212591235:AAHM9Zq2gsq-xVVrFFVnNBf3IU25bCL0CxU");
const fetch = require("node-fetch");
const http = require('http');
let lastCoins = [];


bot.start((ctx) => {
    const keyboard = Markup.keyboard([
        ['BTC', 'ETH', 'TRX', 'MATIC'],
        ['ZEC', 'FTM', 'LINK', 'AVAX'],
        ['Choose a coin'],
    ]);

    ctx.reply("Select a crypto currency:", keyboard);
});

bot.hears('Choose a coin', (ctx) => {
    ctx.reply('Please enter the name of the coin you want to check prices for. \n\nExample: LTC, SOL, CAKE');
});

bot.command('reset', (ctx) => {
    resetPrices(lastCoins);
    ctx.reply('All prices updates have been reset.');
});

bot.on('text', async (ctx) => {
    const messageText = ctx.message.text.trim();

    if (!messageText.startsWith('/')) {
        const text = messageText.toUpperCase();
        const message = await ctx.reply(`Loading prices for ${text}...`);
        await getCoins(text, message, ctx);
    }
});

async function getCoins(coin, message, ctx) {
    try {
        const prices = await getPrices(coin);

        if (Object.keys(prices).length === 0) {
            throw new Error(`Could not find prices for ${coin}`);
        }

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

        const errorMessages = [`Oops, looks like I'm having trouble fetching prices for ${coin} 😬`, `Sorry, ${coin} is feeling a little shy today and hiding its prices from me 😶`, `Well, this is awkward - I couldn't find any prices for ${coin} 🤐`, `Houston, we have a problem...I couldn't fetch any prices for ${coin} 🚀`, `Looks like ${coin} took a break from the market and didn't tell me about it 🏖️`, `Sorry, I'm drawing a blank on ${coin} prices right now 🤯`, `Hmm, it seems like ${coin} prices are playing hide and seek with me 🙈`, `I'm starting to think ${coin} prices might be an urban legend 🤔`, `Did someone say ${coin}? Sorry, I don't have any prices to report 🤷‍♂️`, `I asked nicely, but ${coin} didn't want to share its prices with us 🙅‍♂️`, `I think ${coin} prices are in hiding...or maybe they just went on vacation 🏝️`, `Sorry, I couldn't find any prices for ${coin} - maybe they're on a coffee break ☕`, `I'm not sure what's going on, but ${coin} prices seem to be in hiding 🕵️`, `I have a feeling ${coin} prices are going incognito on me 🕵️‍♂️`, `Looks like ${coin} prices are off on a secret mission...I'll keep searching 👀`, `I don't want to point fingers, but I have a hunch that ${coin} prices are avoiding me 🤨`, `It's like ${coin} prices disappeared into thin air...I'll keep investigating 👨‍💼`, `Hmm, something tells me ${coin} prices are feeling camera shy today 📷`, `I'm stumped - no luck finding any prices for ${coin} 🤷‍♀️`];

        const randomErrorMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];

        await ctx.telegram.editMessageText(
            message.chat.id,
            message.message_id,
            null,
            randomErrorMessage
        );
    }
}


function updateCoins(coin) {
    lastCoins = lastCoins.filter(lastCoin => lastCoin.coin !== coin.coin);
    lastCoins.push(coin);
    if (lastCoins.length > 2) {
        const {message: oldMessage} = lastCoins.shift();
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
    }, 1500);
    coin.intervalId = intervalId;
}

function generateMessage(prices, coin) {
    const priceValues = prices.map(({price}) => price);
    const maxPrice = Math.max(...priceValues);
    const minPrice = Math.min(...priceValues);
    const spread = Math.floor(((maxPrice - minPrice) / minPrice) * 10000) / 100;

    prices.sort((a, b) => b.price - a.price);

    const newMessage =
        `${coin}USDT\n` +
        "===================\n\n" +
        prices
            .map(
                ({exchange, price}, index) => `${index + 1}. ${exchange}:  $${price}`
            )
            .join("\n\n") +
        "\n\n===================\n" +
        `Spread: ${spread}%`;

    return newMessage;
}

function scheduleCoinRemoval(coin) {
    setTimeout(() => {
        clearInterval(coin.intervalId);
        lastCoins = lastCoins.filter(lastCoin => lastCoin.coin !== coin.coin);
    }, 90000);
}

async function getPrices(coin) {
    const binancePrice = await getBinanceBtcPrice(coin);
    const binanceUSPrice = await getBinanceUsBtcPrice(coin);
    const bybitPrice = await getBybitBtcPrice(coin);
    const kuCoinPrice = await getKucoinBtcPrice(coin);

    return [
        {exchange: "Binance", price: binancePrice},
        {exchange: "KuCoin", price: kuCoinPrice},
        {exchange: "Binance US", price: binanceUSPrice},
        {exchange: "Bybit", price: bybitPrice},
    ];
}

async function getBinanceBtcPrice(coin) {
    try {
        const response = await fetch(
            `https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`
        );
        const data = await response.json();
        console.log(+data.price);
        return +data.price;
    } catch (error) {
        console.error(`Failed to get Binance ${coin} price`);
        throw new Error(`Failed to get Binance ${coin} price`);
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
        console.error('Error from Binance US');
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
            `Error getting price for ${coin} from Bybit:`
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
        console.error(`Error fetching price from Kucoin API: `);
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


function resetPrices(lastCoins) {
    for (const coin of lastCoins) {
        clearInterval(coin.message.intervalId);
    }
    lastCoins.length = 0; // очищаем массив
}

bot.launch();
