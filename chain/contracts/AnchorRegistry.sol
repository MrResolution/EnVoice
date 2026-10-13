// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Stores Merkle roots of Invoseal audit-log batches. Nothing else goes on-chain:
/// no documents, names or amounts, only 32-byte commitments and the entry range they cover.
contract AnchorRegistry {
    struct Batch {
        bytes32 root;
        uint64 fromSeq;
        uint64 toSeq;
        uint64 blockNumber;
    }

    address public immutable owner;
    Batch[] public batches;

    event Anchored(uint256 indexed index, bytes32 root, uint64 fromSeq, uint64 toSeq);

    constructor() {
        owner = msg.sender;
    }

    /// Append-only: there is no function to change or remove a batch.
    function anchor(bytes32 root, uint64 fromSeq, uint64 toSeq) external returns (uint256 index) {
        require(msg.sender == owner, "only owner");
        require(root != bytes32(0) && fromSeq <= toSeq, "bad batch");
        batches.push(Batch(root, fromSeq, toSeq, uint64(block.number)));
        index = batches.length - 1;
        emit Anchored(index, root, fromSeq, toSeq);
    }

    function count() external view returns (uint256) {
        return batches.length;
    }
}
