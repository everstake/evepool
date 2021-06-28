# EvePool Contracts

EvePool is a pool contract for users who want to participate in Ethereum 2.0 staking, but do not have a minimum amount of 32 ETH or capacity to run a validator node.

Users deposit funds to the pool contract (using the `stake` function) and wait until at least 32 ETH is collected in the queue. Once it happens, the admin for the system will call the `deposit` function which sends 32 ETH to the system Deposit contract using credentials for the new validator node run by the pool operator. Once these funds are deposited the users can call the `claim` function to receive their pool tokens (which later can be used to claim back their deposited funds).

Pool token is a token with a dynamic user balance. It means that when new rewards are sent to the validator node operators it will increase the overall balance of the funds in the system and user balances will be updated to reflect this amount.

Since there is no direct communication between Ethereum 1.0 and Ethereum 2.0 blockchains the amount of rewards are reported by the set of oracles. It happens via `SetRewards` proposal in the `Governor` contract. Once the quorum is reached and 2/3rd of the oracles report the same amount then rewards will be updated in the main contract.

## Requirements

- Node.js v12.0 or higher
- Truffle v5.1.44 or higher

## Installation

```
npm install
```

## Running

### Compile contracts

```
npm run compile
```

### Running tests

```
npm run test
```

### Deploying Contracts
```
npm run migrate
```
Contract deploy scripts require several environment variables. You can set them up in `.env` file using `.env.example` as an example.

## Licence
MIT