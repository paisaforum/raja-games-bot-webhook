#!/bin/bash

echo "Creating data folder structure for codes..."

mkdir -p data/codes
touch data/codes/15.txt
touch data/codes/25.txt
touch data/codes/50.txt
touch data/codes/100.txt
touch data/codes/250.txt
touch data/codes/500.txt

echo "{}" > data/users.json

echo "✅ Folder structure created successfully!"
