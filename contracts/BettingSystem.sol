// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BettingSystem {
    
    event EventCreated(uint256 indexed eventId, string description); // Evento para criação de evento
    
    struct Event {
        string description;
        string[] outcomes;
        bool active;
        bool finalized;
        uint256 winningOutcomeIndex;
    }

    Event[] public events;
    mapping(uint256 => mapping(uint256 => uint256)) public totalBets; // eventId -> outcome -> total bet amount
    mapping(uint256 => mapping(address => uint256)) public bets;      // eventId -> user -> bet amount
    mapping(uint256 => mapping(address => uint256)) public selectedOutcome; // eventId -> user -> outcome index
    mapping(uint256 => address[]) public participants; // eventId -> participants
    address public owner;



    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Somente o dono pode executar esta funcao.");
        _;
    }

    function createEvent(string memory _description, string[] memory _outcomes) public onlyOwner {
        uint256 eventId = events.length;

        require(_outcomes.length >= 2, "O evento deve ter pelo menos dois resultados possiveis.");
        events.push(Event({
            description: _description,
            outcomes: _outcomes,
            active: true,
            finalized: false,
            winningOutcomeIndex: 0
        }));

        emit EventCreated(eventId, _description);
    }

    function placeBet(uint256 _eventId, uint256 _outcomeIndex) public payable {
        require(_eventId < events.length, "Evento invalido.");
        require(events[_eventId].active, "Evento nao esta ativo.");
        require(_outcomeIndex < events[_eventId].outcomes.length, "Resultado invalido."); // Adicionado
        require(msg.value > 0, "Voce precisa apostar algum valor.");

        totalBets[_eventId][_outcomeIndex] += msg.value;
        bets[_eventId][msg.sender] += msg.value;
        selectedOutcome[_eventId][msg.sender] = _outcomeIndex;
        participants[_eventId].push(msg.sender);
    }

    function finalizeEvent(uint256 _eventId, uint256 _winningOutcomeIndex) public onlyOwner {
        require(_eventId < events.length, "Evento invalido.");
        Event storage betEvent = events[_eventId];
        require(betEvent.active, "Evento ja foi finalizado.");
        require(_winningOutcomeIndex < betEvent.outcomes.length, "Resultado invalido.");

        betEvent.active = false;
        betEvent.finalized = true;
        betEvent.winningOutcomeIndex = _winningOutcomeIndex;

        address[] memory eventParticipants = participants[_eventId];
        uint256 totalPool = totalBets[_eventId][_winningOutcomeIndex];

        for (uint256 i = 0; i < eventParticipants.length; i++) {
            address user = eventParticipants[i];
            if (selectedOutcome[_eventId][user] == _winningOutcomeIndex) {
                uint256 reward = (bets[_eventId][user] * totalPool) / totalBets[_eventId][_winningOutcomeIndex];
                payable(user).transfer(reward);
            }
        }
    }

    function getEvent(uint256 _eventId)
        public
        view
        returns (
            string memory,
            string[] memory,
            bool,
            bool,
            uint256
        )
    {
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
