// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract Test {
    string private _message;

    constructor(string memory initialMessage) {
        _message = initialMessage;
    }

    function message() public view returns (string memory) {
        return _message;
    }

    function setMessage(string memory newMessage) public {
        _message = newMessage;
    }
}
