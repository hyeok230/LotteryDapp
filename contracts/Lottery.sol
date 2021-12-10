// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract Lottery {
    struct BetInfo {
        uint256 answerBlockNumber;
        address payable bettor;
        bytes challenges; // 0xab
    }

    //Lottery에서 사용할 자료구조는 queue
    uint256 private _tail;
    uint256 private _head;
    mapping (uint256 => BetInfo) private _bets;
    
    address public owner;

    uint256 constant internal BLOCK_LIMIT = 256;
    uint256 constant internal BET_BLOCK_INTERVAL = 3;
    uint256 constant internal BET_AMOUNT = 5 * 10 ** 15;
    uint256 private _pot;

    event BET(uint256 index, address bettor, uint256 amount, bytes challenges, uint256 answerBlockNumber);
    constructor() {
        owner = msg.sender;
    }

    function getPot() public view returns (uint256 pot) {
        return _pot;
    }

    // Bet
    /**
    @dev 배팅을 한다. 유저는 0.005 ETH를 보내야 하고, 배팅용 1 byte 글자를 보낸다.
    큐에 저장된 배팅 정보는 이후 distribute 함수에서 해결한다.
    @param challenges 유저가 배팅할 1 byte 단어
    @return result -> 함수가 잘 수행되었는지 확인하는 bool 값
     */
    function bet(bytes memory challenges) public payable returns (bool result) {
        // check the proper ether sent
        // msg.value를 통해 들어온 eth 값을 확인할 수 있다.
        require(msg.value == BET_AMOUNT, "Not exact ETH");
        
        // push bet to the queue
        require(pushBet(challenges), "Fail to push Bet Info");
        // emit event
        emit BET(_tail - 1, msg.sender, msg.value, challenges, block.number + BET_BLOCK_INTERVAL);
        return true;
    }
        // save the bet to the queue

    // Distribute
        // check the answer
    function getBetInfo(uint256 index) public view returns (uint256 answerBlockNumber, address bettor, bytes memory challenges) {
        BetInfo memory b = _bets[index];
        answerBlockNumber = b.answerBlockNumber;
        bettor = b.bettor;
        challenges = b.challenges;
    }

    function pushBet(bytes memory challenges) internal returns (bool) {
        BetInfo memory b;
        b.bettor = payable(msg.sender);
        b.answerBlockNumber = block.number + BET_BLOCK_INTERVAL;
        b.challenges = challenges;

        _bets[_tail] = b;
        _tail++;
        return true;
    }

    function popBet(uint256 index) internal returns (bool) {
        // map의 값을 delete 하게 되면 gas를 돌려받게 된다.
        delete _bets[index];
        return true;
    }
}