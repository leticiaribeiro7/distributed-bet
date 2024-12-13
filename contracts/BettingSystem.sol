// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BettingSystem {
    struct Event {
        string description;  // Descrição do evento
        string[] outcomes;   // Resultados possíveis (ex.: "cara", "coroa")
        bool active;         // Se o evento ainda está ativo
        bool finalized;      // Se o evento foi finalizado
        uint256 winningOutcomeIndex; // Índice do resultado vencedor
        mapping(uint256 => uint256) totalBets; // Valor total apostado em cada resultado
        mapping(address => uint256) bets; // Aposta do usuário
        mapping(address => uint256) selectedOutcome; // Resultado escolhido pelo usuário
    }

    Event[] public events; // Lista de eventos
    mapping(uint256 => address[]) public participants; // Participantes por evento
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Somente o dono pode executar esta funcao.");
        _;
    }

    event BetCriada(uint256 eventId, string description);
    event BetEfetuada(uint256 eventId, address indexed user, uint256 amount, uint256 outcome, string description);
    event BetFinalizada(uint256 eventId, uint256 result, string description);

    function createEvent(string memory _description, string[] memory _outcomes) public {
        require(_outcomes.length >= 2, "O evento deve ter pelo menos dois resultados possiveis.");
        uint256 eventId = events.length; // verificar antes de add um novo na lista porque começa do zero

        Event storage newEvent = events.push();
        newEvent.description = _description;
        newEvent.outcomes = _outcomes;
        newEvent.active = true;
        newEvent.finalized = false;


        emit BetCriada(eventId, _description);
    }

    function placeBet(uint256 _eventId, uint256 _outcomeIndex) public payable {
        require(_eventId < events.length, "Evento invalido.");
        require(events[_eventId].active, "Evento nao esta ativo.");
        require(msg.value > 0, "Voce precisa apostar algum valor.");

        Event storage betEvent = events[_eventId];
        betEvent.totalBets[_outcomeIndex] += msg.value;
        betEvent.bets[msg.sender] += msg.value;
        betEvent.selectedOutcome[msg.sender] = _outcomeIndex;
        participants[_eventId].push(msg.sender);

        emit BetEfetuada(_eventId, msg.sender, msg.value, _outcomeIndex, betEvent.description);
    }

    function finalizeEvent(uint256 _eventId, uint256 _winningOutcomeIndex) public onlyOwner {
        require(_eventId < events.length, "Evento invalido.");
        Event storage betEvent = events[_eventId];
        require(betEvent.active, "Evento ja foi finalizado.");
        require(_winningOutcomeIndex < betEvent.outcomes.length, "Resultado invalido.");

        betEvent.active = false;
        betEvent.finalized = true;
        betEvent.winningOutcomeIndex = _winningOutcomeIndex;

        // Distribuir fundos
        address[] memory eventParticipants = participants[_eventId];
        uint256 totalPool = betEvent.totalBets[_winningOutcomeIndex];

        for (uint256 i = 0; i < eventParticipants.length; i++) {
            address user = eventParticipants[i];
            if (betEvent.selectedOutcome[user] == _winningOutcomeIndex) {
                uint256 reward = (betEvent.bets[user] * totalPool) /
                    betEvent.totalBets[_winningOutcomeIndex];
                payable(user).transfer(reward);
            }
        }

        emit BetFinalizada(_eventId, _winningOutcomeIndex, betEvent.description);
    }

    function getEvent(uint256 _eventId) public view returns (string memory, string[] memory, bool, bool, uint256) {
        require(_eventId < events.length, "Evento invalido.");
        Event storage betEvent = events[_eventId];
        return (
            betEvent.description,
            betEvent.outcomes,
            betEvent.active,
            betEvent.finalized,
            betEvent.winningOutcomeIndex
        );
    }
}
