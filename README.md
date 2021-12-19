# [Votemak](https://votemak.com/) - Tokemak Vote Bribing

API: https://votemak-api.vercel.app/api/user?address=0x0000000000000000000000000000000000000000

## Contract Addresses

VotemakBribe: [0x77158da68347f087c7fbee065249cf4867a2e7d3](https://etherscan.io/address/0x77158da68347f087c7fbee065249cf4867a2e7d3)

MultiMerkleDistributor: [0x639d20f70bcc01a25355720ef6590beab6e4a0e7](https://etherscan.io/address/0x639d20f70bcc01a25355720ef6590beab6e4a0e7)

Multisig: [0x8CA6E5e53928e8E94a72F8c1Fb494Afda23D7C61](https://etherscan.io/address/0x8CA6E5e53928e8E94a72F8c1Fb494Afda23D7C61)

## Install

```
yarn install
yarn compile
```

## Environment variables

Create a `.env` file similar to `.env.example` and add any required environment variables there

## Snapshot

Required environment variables: `ETH_RPC_URL`, `POLYGON_RPC_URL`

### Generate snapshot of votes

```
yarn snapshot
```

### Generate snapshots for each reactor

Must be run after `yarn snapshot`

```
yarn snapshot-reactors
```

### Generate merkle tree to distribute bribes

Must be run after `yarn snapshot`

```
yarn generate
```

### Validate votes and the merkle tree

Must be run after `yarn snapshot` and `yarn generate`

```
yarn validate
```

## Contracts

### Test

```
yarn test
```

### Deploy

Required environment variables: `MNEMONIC`, `INFURA_API_KEY`

```
yarn deploy --network mainnet
```

### Verify deployed contracts on Etherscan

Required environment variables: `ETHERSCAN`

```
yarn verify --network mainnet
```

## API

### Start

```
yarn start
```

Open [localhost:3000](http://localhost:3000/api/user?address=0x0000000000000000000000000000000000000000) to see the API

## Lint

```
yarn lint
```

## Clean

```
yarn clean
```
