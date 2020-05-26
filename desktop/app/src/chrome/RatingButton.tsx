/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import React, {Component, ReactElement} from 'react';
import {
  Glyph,
  Popover,
  FlexColumn,
  FlexRow,
  Button,
  Checkbox,
  styled,
  Input,
} from 'flipper';
import GK from '../fb-stubs/GK';
import * as UserFeedback from '../fb-stubs/UserFeedback';
import {FeedbackPrompt} from '../fb-stubs/UserFeedback';
import {connect} from 'react-redux';
import {State as Store} from 'app/src/reducers';

type PropsFromState = {
  sessionId: string | null;
};

type State = {
  promptData: FeedbackPrompt | null;
  isShown: boolean;
  hasTriggered: boolean;
};

type NextAction = 'select-rating' | 'leave-comment' | 'finished';

class PredefinedComment extends Component<{
  comment: string;
  selected: boolean;
  onClick: (_: unknown) => unknown;
}> {
  static Container = styled.div<{selected: boolean}>((props) => {
    return {
      border: '1px solid #f2f3f5',
      cursor: 'pointer',
      borderRadius: 24,
      backgroundColor: props.selected ? '#ecf3ff' : '#f2f3f5',
      marginBottom: 4,
      marginRight: 4,
      padding: '4px 8px',
      color: props.selected ? 'rgb(56, 88, 152)' : undefined,
      borderColor: props.selected ? '#3578e5' : undefined,
      ':hover': {
        borderColor: '#3578e5',
      },
    };
  });
  render() {
    return (
      <PredefinedComment.Container
        onClick={this.props.onClick}
        selected={this.props.selected}>
        {this.props.comment}
      </PredefinedComment.Container>
    );
  }
}

const Row = styled(FlexRow)({
  marginTop: 5,
  marginBottom: 5,
  justifyContent: 'center',
  textAlign: 'center',
  color: '#9a9a9a',
  flexWrap: 'wrap',
});

const DismissRow = styled(Row)({
  marginBottom: 0,
  marginTop: 10,
});

const DismissButton = styled.span({
  '&:hover': {
    textDecoration: 'underline',
    cursor: 'pointer',
  },
});

const Spacer = styled(FlexColumn)({
  flexGrow: 1,
});

function dismissRow(dismiss: () => void) {
  return (
    <DismissRow key="dismiss">
      <Spacer />
      <DismissButton onClick={dismiss}>Dismiss</DismissButton>
      <Spacer />
    </DismissRow>
  );
}

type FeedbackComponentState = {
  rating: number | null;
  hoveredRating: number;
  allowUserInfoSharing: boolean;
  nextAction: NextAction;
  predefinedComments: {[key: string]: boolean};
  comment: string;
};

class FeedbackComponent extends Component<
  {
    submitRating: (rating: number) => void;
    submitComment: (
      rating: number,
      comment: string,
      selectedPredefinedComments: Array<string>,
      allowUserInfoSharing: boolean,
    ) => void;
    close: () => void;
    dismiss: () => void;
    promptData: FeedbackPrompt;
  },
  FeedbackComponentState
> {
  state: FeedbackComponentState = {
    rating: null,
    hoveredRating: 0,
    allowUserInfoSharing: true,
    nextAction: 'select-rating' as NextAction,
    predefinedComments: this.props.promptData.predefinedComments.reduce(
      (acc, cv) => ({...acc, [cv]: false}),
      {},
    ),
    comment: '',
  };
  onSubmitRating(newRating: number) {
    const nextAction = newRating <= 2 ? 'leave-comment' : 'finished';
    this.setState({rating: newRating, nextAction: nextAction});
    this.props.submitRating(newRating);
    if (nextAction === 'finished') {
      setTimeout(this.props.close, 1500);
    }
  }
  onCommentSubmitted(comment: string) {
    this.setState({nextAction: 'finished'});
    const selectedPredefinedComments: Array<string> = Object.entries(
      this.state.predefinedComments,
    )
      .map((x) => ({comment: x[0], enabled: x[1]}))
      .filter((x) => x.enabled)
      .map((x) => x.comment);
    const currentRating = this.state.rating;
    if (currentRating) {
      this.props.submitComment(
        currentRating,
        comment,
        selectedPredefinedComments,
        this.state.allowUserInfoSharing,
      );
    } else {
      console.error('Illegal state: Submitting comment with no rating set.');
    }
    setTimeout(this.props.close, 1000);
  }
  onAllowUserSharingChanged(allowed: boolean) {
    this.setState({allowUserInfoSharing: allowed});
  }
  render() {
    const stars = Array(5)
      .fill(true)
      .map<JSX.Element>((_, index) => (
        <div
          key={index}
          role="button"
          tabIndex={0}
          onMouseEnter={() => {
            this.setState({hoveredRating: index + 1});
          }}
          onMouseLeave={() => {
            this.setState({hoveredRating: 0});
          }}
          onClick={() => {
            this.onSubmitRating(index + 1);
          }}>
          <Glyph
            name={
              (
                this.state.hoveredRating
                  ? index < this.state.hoveredRating
                  : index < (this.state.rating || 0)
              )
                ? 'star'
                : 'star-outline'
            }
            color="grey"
            size={24}
          />
        </div>
      ));
    let body: Array<ReactElement>;
    switch (this.state.nextAction) {
      case 'select-rating':
        body = [
          <Row key="bodyText">{this.props.promptData.bodyText}</Row>,
          <Row key="stars" style={{margin: 'auto'}}>
            {stars}
          </Row>,
          dismissRow(this.props.dismiss),
        ];
        break;
      case 'leave-comment':
        const predefinedComments = Object.entries(
          this.state.predefinedComments,
        ).map((c: [string, unknown], idx: number) => (
          <PredefinedComment
            key={idx}
            comment={c[0]}
            selected={Boolean(c[1])}
            onClick={() =>
              this.setState({
                predefinedComments: {
                  ...this.state.predefinedComments,
                  [c[0]]: !c[1],
                },
              })
            }
          />
        ));
        body = [
          <Row key="predefinedComments">{predefinedComments}</Row>,
          <Row key="inputRow">
            <Input
              style={{height: 30, width: '100%'}}
              placeholder={this.props.promptData.commentPlaceholder}
              value={this.state.comment}
              onChange={(e) => this.setState({comment: e.target.value})}
              onKeyDown={(e) =>
                e.key == 'Enter' && this.onCommentSubmitted(this.state.comment)
              }
              autoFocus={true}
            />
          </Row>,
          <Row key="contactCheckbox">
            <Checkbox
              checked={this.state.allowUserInfoSharing}
              onChange={this.onAllowUserSharingChanged.bind(this)}
            />
            {'Tool owner can contact me '}
          </Row>,
          <Row key="submit">
            <Button onClick={() => this.onCommentSubmitted(this.state.comment)}>
              Submit
            </Button>
          </Row>,
          dismissRow(this.props.dismiss),
        ];
        break;
      case 'finished':
        body = [<Row key="thanks">Thanks!</Row>];
        break;
      default: {
        console.error('Illegal state: nextAction: ' + this.state.nextAction);
        return null;
      }
    }
    return (
      <FlexColumn
        style={{
          width: 400,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 10,
          paddingBottom: 10,
        }}>
        <Row key="heading" style={{color: 'black', fontSize: 20}}>
          {this.state.nextAction === 'finished'
            ? this.props.promptData.postSubmitHeading
            : this.props.promptData.preSubmitHeading}
        </Row>
        {body}
      </FlexColumn>
    );
  }
}

class RatingButton extends Component<PropsFromState, State> {
  state: State = {
    promptData: null,
    isShown: false,
    hasTriggered: false,
  };

  constructor(props: PropsFromState) {
    super(props);
    if (GK.get('flipper_rating')) {
      UserFeedback.getPrompt().then((prompt) => {
        this.setState({promptData: prompt});
        setTimeout(this.triggerPopover.bind(this), 30000);
      });
    }
  }

  onClick() {
    const willBeShown = !this.state.isShown;
    this.setState({isShown: willBeShown, hasTriggered: true});
    if (!willBeShown) {
      UserFeedback.dismiss(this.props.sessionId);
    }
  }

  submitRating(rating: number) {
    UserFeedback.submitRating(rating, this.props.sessionId);
  }

  submitComment(
    rating: number,
    comment: string,
    selectedPredefinedComments: Array<string>,
    allowUserInfoSharing: boolean,
  ) {
    UserFeedback.submitComment(
      rating,
      comment,
      selectedPredefinedComments,
      allowUserInfoSharing,
      this.props.sessionId,
    );
  }

  triggerPopover() {
    if (!this.state.hasTriggered) {
      this.setState({isShown: true, hasTriggered: true});
    }
  }

  render() {
    const promptData = this.state.promptData;
    if (!promptData) {
      return null;
    }
    if (
      !promptData.shouldPopup ||
      (this.state.hasTriggered && !this.state.isShown)
    ) {
      return null;
    }
    return (
      <div style={{position: 'relative'}}>
        <div onClick={this.onClick.bind(this)}>
          <Glyph
            name="star"
            color="grey"
            variant={this.state.isShown ? 'filled' : 'outline'}
          />
        </div>
        {this.state.isShown ? (
          <Popover
            onDismiss={() => {}}
            children={
              <FeedbackComponent
                submitRating={this.submitRating.bind(this)}
                submitComment={this.submitComment.bind(this)}
                close={() => {
                  this.setState({isShown: false});
                }}
                dismiss={this.onClick.bind(this)}
                promptData={promptData}
              />
            }
          />
        ) : null}
      </div>
    );
  }
}

export default connect<{sessionId: string | null}, null, {}, Store>(
  ({application: {sessionId}}) => ({sessionId}),
)(RatingButton);
