def get_rates(eth_price=300):
    prices_after_discount = [0.16, 0.17, 0.18, 0.19, 0.20]
    rates = []
    for price in prices_after_discount:
        rates.append(round(eth_price / price))
    return rates

def get_goal_in_eth(eth_price=300):
    goal_in_eur = 1000000.0
    return round(goal_in_eur / eth_price)

eth_price = int(raw_input('Current ETH price in euros?\n'))
print "FCC rates: %s" % get_rates(eth_price)
print "Goal in ETH: %s" % get_goal_in_eth(eth_price)
