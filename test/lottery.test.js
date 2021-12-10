const { assert } = require("chai");
const assertRevert = require("./assertRevert");
const expectEvent = require("./expectEvent");
const Lottery = artifacts.require("Lottery");

//function의 파라미터로 최대 10개까지 줄 수 있다.
//ganache에서 만든 10가지의 account들이 순서대로 들어오게 된다.
//deployer - 0번 주소, user1 - 1번 주소, user2 - 2번 주소

//migrations 폴더에 있는 deploy script는 사실 test할 때는 사용되지 않는다
//따라서 lottery = await Lottery.new(); 를 통해 배포하는 것이 좋다
//migrations가 돌지만 클린룸에서 사용하는 스마트컨트랙트를 사용하는 것이 좋기 때문이다
//즉, deploy된 스마트 컨트랙트를 연계할 수 도 있지만 항상 클린룸에 새로 배포해 줄 것
contract('Lottery', function([deployer, user1, user2]){
    let lottery;
    let betAmount = 5 * 10 ** 15;
    let bet_block_interval = 3;

    beforeEach(async () => {
        lottery = await Lottery.new();
    })

    // 테스트 시 한 파일 내에서 하나의 테스트만 시행하고 싶은 경우
    // it.only를 사용하면 된다.
    it('getPot should return current pot', async () => {
        console.log('Basic test')
        let pot = await lottery.getPot();
    
        console.log(`value : ${pot}`);
        assert.equal(pot, 0)
    })

    describe('Bet', function () {
        it('should fail when the bet money is not 0.005 ETH', async () => {
            // Fail transaction
            await assertRevert(lottery.bet('0xab', {from : user1, value : 4000000000000000}))
            // transaction object {chainId, value, to, from, gasLimit, gasPrice}
        })
        
        it('should put the bet to the Bet queue with 1 bet', async () => {
            // bet
            let receipt = await lottery.bet('0xab', {from : user1, value : betAmount})
            // console.log(receipt);

            let pot = await lottery.getPot();
            assert.equal(pot, 0);
            // check contract blance == 0.05
            let contractBalance = await web3.eth.getBalance(lottery.address);
            assert.equal(contractBalance, betAmount)
            // check Bet info
            let currentBlockNumber = await web3.eth.getBlockNumber();
            let bet = await lottery.getBetInfo(0);

            assert.equal(bet.answerBlockNumber, currentBlockNumber + bet_block_interval);
            assert.equal(bet.bettor, user1);
            assert.equal(bet.challenges, '0xab');
            // check log
            // console.log(receipt);
            await expectEvent.inLogs(receipt.logs, 'BET')
        })
    })

    describe.only('isMatch', function() {
        let blockHash = '0xab17b7e54b0ee749f38a478df0f485fc8a99c6aaa8d2aae379a09827aeb5301e'

        it('should be BettingResult.Win when two characters match', async () => {
            let matchResult = await lottery.isMatch('0xab', blockHash)
            assert.equal(matchResult, 1);
        })

        it('should be BettingResult.Fail when two characters match', async () => {
            let matchResult = await lottery.isMatch('0xdd', blockHash)
            assert.equal(matchResult, 0);
        })

        it('should be BettingResult.Draw when two characters match', async () => {
            let matchResult = await lottery.isMatch('0xac', blockHash)
            assert.equal(matchResult, 2);
        })
    })
})