
const web3 = new Web3(`http://127.0.0.1:8547`); // geth
let bettingContract;


async function getConfig() {
    const res = await fetch('../build/contracts/BettingSystem.json')
    const data = await res.json()
    return data
}


function updateContract() {
    return getConfig()
        .then(data => {
            const contractAddress = data.networks["1337"]?.address;
            bettingContract = new web3.eth.Contract(data.abi, contractAddress);
            console.log("Contrato carregado:", contractAddress);
        })
        .catch(error => {
            console.error("Erro ao obter o contrato:", error);
        });
}


// Obter contas e popular o seletor
async function populateAccountSelector() {
    const accounts = await web3.eth.getAccounts();
    const accountSelector = document.getElementById("account-selector");

    accounts.forEach(async account => {
        let balance = await web3.eth.getBalance(account)
        const option = document.createElement("option");
        option.value = account;
        option.textContent = `${account} - saldo ${web3.utils.fromWei(balance, "ether")} ETH`;
        accountSelector.appendChild(option);
    });
}

// Obter conta selecionada
function getSelectedAccount() {
    return document.getElementById("account-selector").value;
}

// Criar evento
async function createEvent(description, outcomes) {
    const owner = getSelectedAccount();
    await bettingContract.methods.createEvent(description, outcomes).send({ from: owner, gas: 200000 });
    console.log("Evento criado com sucesso!");
}

// Fazer aposta
async function placeBet(eventId, outcomeIndex, amount, user) {
    await bettingContract.methods.placeBet(eventId, outcomeIndex).send({
        from: user,
        value: web3.utils.toWei(amount, "ether"),
        gas: 170000
    });
    console.log(`Aposta feita por ${user} no evento ${eventId}, no resultado ${outcomeIndex}`);
}

// Finalizar evento
async function finalizeEvent(eventId, winningOutcomeIndex) {
    const owner = getSelectedAccount();
    const { 0: description } = await getEvent(eventId);
    const result = await bettingContract.methods.finalizeEvent(eventId, winningOutcomeIndex).send({ from: owner });

    console.log(result)
    alert(`Bet ${description} finalizada`);
    window.location.reload(true)
}

// Obter detalhes do evento
async function getEvent(eventId) {
    return await bettingContract.methods.getEvent(eventId).call();
}

// Apostar em um evento
async function betOnEvent(eventId, outcomeIndex) {
    const amount = prompt("Quanto deseja apostar (em ETH)?", "1");
    const user = getSelectedAccount();

    // Verifica se a conta foi selecionada, se colocou o valor da aposta e se tem dinheiro suficiente
    if (user && amount && !(web3.eth.getBalance(user) > 0)) {
        await placeBet(eventId, outcomeIndex, amount, user);
        alert("Aposta realizada com sucesso!");
    } else {
        alert('Você não tem saldo para apostar!')
    }
    
    await updateLogs();

}

// Atualizar lista de eventos
async function updateEventsList() {
    const eventsList = document.getElementById('events-list');
    const endedEvents = document.getElementById('ended-events-list');
    eventsList.innerHTML = ''; // Limpar lista
    endedEvents.innerHTML = ''; // Limpar lista
    let eventId = 0;


    try {
        while (true) {
            const {
                0: description,
                1: outcomes,
                2: active,
                3: finalized,
                4: winningOutcomeIndex
            } = await getEvent(eventId);

            if (active) {
                const li = document.createElement('li');

                // Gerar os botões para cada resultado
                const buttonsHTML = outcomes
                    .map((outcome, index) => `<button onclick="betOnEvent(${eventId}, ${index})">Apostar em ${outcome}</button>`)
                    .join(' ');

                // Definir o conteúdo HTML da li
                li.innerHTML = `
                <strong>${description}</strong> - Resultados: ${outcomes.join(', ')}
                ${buttonsHTML}
                <button id="finalizaBet" onclick="finalizarBet(${eventId})">Finalizar aposta</button>
                `;

                // Adicionar a li à lista de eventos
                eventsList.appendChild(li);
            } else if (finalized) {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${description}</strong> - Resultado final: ${outcomes[winningOutcomeIndex]}`
                endedEvents.appendChild(li);
            }
            eventId++;
        }
    } catch (error) {
        console.log("Todos os eventos listados.", error);
    }
}



// Finalizar uma aposta e pagar os ganhadores
async function finalizarBet(eventId) {

    try {
        const { 1: outcomes } = await getEvent(eventId)
        let randomNumber = parseInt(Math.random() * outcomes.length)

        await finalizeEvent(eventId, randomNumber)
    } catch (error) {
        console.log(error)
    }
}

async function getAllContractLogs() {
    let eventsFormatted = []
    try {
        const events = await bettingContract.getPastEvents('allEvents', {
            fromBlock: 0,
            toBlock: 'latest',
        });


        for (event of events) {

            const transaction = await web3.eth.getTransaction(event.transactionHash)

            eventsFormatted.push({
                evento: event.event,
                transactionHash: event.transactionHash,
                from: transaction.from,
                to: transaction.to,
                value: web3.utils.fromWei(transaction.value, "ether"),
                description: event.returnValues.description
            })

        }
        return eventsFormatted

    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
    }
}

async function updateLogs() {
    const logsDiv = document.getElementById('logs');
    logsDiv.innerHTML = '';

    const events = await getAllContractLogs();

    if (!events) {
        logsDiv.innerHTML = '<p>Nenhum evento encontrado.</p>';
        return;
    }

    console.log(events)

    events.forEach((event) => {
        const p = document.createElement('p');

        if (event.evento == "BetCriada") {
            p.textContent = `${event.from} criou uma nova aposta usando o contrato ${event.to}`
        }

        if (event.evento == "BetEfetuada") {
            p.textContent = `${event.from} apostou ${event.value} ETH na Bet ${event.description}`
        }

        if (event.evento == "BetFinalizada") {
            p.textContent = `A aposta ${event.description} foi finalizada`
        }

        logsDiv.prepend(p) // mais novos no topo da lista
    });
}



document.getElementById('create-event-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const description = document.getElementById('description').value;
    const outcomes = document.getElementById('outcomes').value.split(',').map(s => s.trim());

    await createEvent(description, outcomes);
    alert("Evento criado com sucesso!");
    document.getElementById('create-event-form').reset();
    await updateEventsList();
    await updateLogs();
});

// Desbloqueia as contas uma vez enquanto o navegador estiver aberto
document.addEventListener("DOMContentLoaded", async function () {
    if (!sessionStorage.getItem("ContasDesbloqueadas")) {
        const accounts = await web3.eth.getAccounts();

        for (const account of accounts) {
            console.log(account);
            await web3.eth.personal.unlockAccount(account, "senha", 15000);
        }

        sessionStorage.setItem("ContasDesbloqueadas", "true");
    }
});

window.onload = async () => {
    try {
        await updateContract();
        await populateAccountSelector(); 
        await updateEventsList();        
        await updateLogs();              

        
    } catch (error) {
        console.error("Erro ao inicializar a página:", error);
    }
}
