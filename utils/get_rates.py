def get_rates(eth_price=300):
    prices_after_discount = [0.16, 0.17, 0.18, 0.19, 0.20]
    rates = []
    for price in prices_after_discount:
        rates.append(round(eth_price / price))
    return rates

eth_price = int(raw_input('Current ETH price in euros?\n'))
print get_rates(eth_price)
