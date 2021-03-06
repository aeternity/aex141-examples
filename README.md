# NFT contracts and tooling
This repo contains example contracts and tooling for Non-Fungible Tokens based on Aeternity's [AEX-141](https://github.com/aeternity/AEXs/blob/master/AEXS/aex-141.md) standard.

## License
Copyright (c) 2022 [Toqns Inc.](https://toqns.com)

ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

## Support
For support please use the [Aeternity Forum](https://forum.aeternity.com).
For bugs and feature requests (including other examples) please open an issue on this GitHub repo.

## How to use

The repo provides different kinds of example contracts. The contracts can be found in the `contracts` directory. Test cases can be found in the `test` directory.

Although this repo uses aeproject, it's not recommended to use this repo as a base project. Instead copy the contract(s) and tests into your own project.

### Example contracts

- `base_nft.aes` is an example of a uniqe NFT representing a single object.
- `mintable_burnable.aes` is an example of an NFT with the `mintable` and `burnable` extension.
- `swappable.aes` is and example of an NFT with the `swappable` extension.
- `credential.aes` is an example of a mintable course graduation NFT smart contract.