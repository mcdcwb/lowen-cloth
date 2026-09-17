import assert from "node:assert/strict";
import test from "node:test";
import { developmentProducts, seedMarker } from "../src/lib/development-products.js";

test("development catalog covers categories, audiences and appropriate variants", () => {
    assert.equal(developmentProducts.length, 12);
    assert.equal(developmentProducts.reduce((sum, product) => sum + product.variants.length, 0), 50);
    for (const category of ["camisetas", "jaquetas", "calcas", "bermudas", "vestidos", "calcados"]) {
        assert.equal(developmentProducts.filter(product => product.category === category).length, 2);
    }
    for (const audience of ["masculino", "feminino", "unissex", "infantil"]) {
        assert.equal(developmentProducts.filter(product => product.public === audience).length, 3);
    }
    for (const product of developmentProducts) {
        assert.ok(product.description?.startsWith(seedMarker));
        assert.equal(new Set(product.variants.map(variant => variant.value)).size, product.variants.length);
        assert.ok(product.variants.every(variant => Number.isInteger(variant.stock) && variant.stock >= 0));
        if (product.category === "calcados") {
            assert.deepEqual(product.variants.map(variant => variant.value), ["36", "37", "38", "39", "40"]);
        }
        assert.ok(product.images.length >= 2);
        assert.equal(product.imageUrl, product.images[0]);
        for (const image of product.images) assert.equal(new URL(image).protocol, "https:");
    }
});
