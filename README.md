# react-card-swipe

A React plugin for reading or capturing card data from magnetic swipe readers.

Note: Requires a magnetic card reader to executed.

## Installation

```sh
npm install react-card-swipe
```

## Using this plugin

```js
import React from "react"
import CardSwipe from 'react-card-swipe'

class SearchPatient extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      swipeData: {}
    }

    CardSwipe.init({
      success: this.handleSwipeSuccess,
      debug: false
    })
  }

  handleSwipeSuccess = (swipeData) => {
    console.log(swipeData)

    this.setState({
      swipeData: swipeData
    })
  }

  render() {
    return (
      <React.Fragment>
        <pre>{JSON.stringify(this.state.swipeData) }</pre>
      </React.Fragment>
    )
  }
}
```

## Credits

This plugin was originally of [CarlRaymond/jquery.cardswipe](https://github.com/CarlRaymond/jquery.cardswipe). This instance simply ports the functionalities into a React plugin.

## :copyright: License

[MIT](http://opensource.org/licenses/MIT)
